const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// JWT Secret
const JWT_SECRET = 'your-secret-key-change-in-production';

// Database initialization
const db = new sqlite3.Database('./forum.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database');
});

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT 'A',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Posts table
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT DEFAULT '日常',
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Comments table
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// ===== Middleware =====
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: '未授权' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '令牌无效' });
    req.user = user;
    next();
  });
};

// ===== Auth Routes =====
// 注册
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (username, email, password, avatar) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, username.charAt(0).toUpperCase()],
    function(err) {
      if (err) {
        return res.status(400).json({ error: '用户已存在或邮箱已注册' });
      }

      const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
      res.json({ 
        message: '注册成功',
        token, 
        user: { id: this.lastID, username, email } 
      });
    }
  );
});

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ 
      message: '登录成功',
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar }
    });
  });
});

// 获取当前用户
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, username, email, avatar FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(user);
  });
});

// ===== Posts Routes =====
// 获取所有帖子
app.get('/api/posts', (req, res) => {
  const category = req.query.category || null;
  let query = `
    SELECT p.*, u.username, u.avatar,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM posts p
    JOIN users u ON p.user_id = u.id
  `;
  const params = [];

  if (category && category !== '全部') {
    query += ' WHERE p.category = ?';
    params.push(category);
  }

  query += ' ORDER BY p.created_at DESC LIMIT 50';

  db.all(query, params, (err, posts) => {
    if (err) {
      return res.status(500).json({ error: '获取帖子失败' });
    }
    res.json(posts || []);
  });
});

// 创建帖子
app.post('/api/posts', authenticateToken, (req, res) => {
  const { title, content, category } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }

  db.run(
    'INSERT INTO posts (user_id, title, content, category) VALUES (?, ?, ?, ?)',
    [req.user.id, title, content, category || '日常'],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '创建帖子失败' });
      }

      io.emit('new_post', {
        id: this.lastID,
        user_id: req.user.id,
        username: req.user.username,
        title,
        content,
        category,
        views: 0,
        comments_count: 0,
        created_at: new Date()
      });

      res.status(201).json({ 
        message: '帖子创建成功',
        id: this.lastID 
      });
    }
  );
});

// 获取单个帖子详情
app.get('/api/posts/:id', (req, res) => {
  const postId = req.params.id;

  db.get(
    `SELECT p.*, u.username, u.avatar,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
     FROM posts p
     JOIN users u ON p.user_id = u.id
     WHERE p.id = ?`,
    [postId],
    (err, post) => {
      if (err || !post) {
        return res.status(404).json({ error: '帖子不存在' });
      }

      // Update view count
      db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);

      res.json(post);
    }
  );
});

// ===== Comments Routes =====
// 获取帖子评论
app.get('/api/posts/:id/comments', (req, res) => {
  const postId = req.params.id;

  db.all(
    `SELECT c.*, u.username, u.avatar
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ?
     ORDER BY c.created_at DESC`,
    [postId],
    (err, comments) => {
      if (err) {
        return res.status(500).json({ error: '获取评论失败' });
      }
      res.json(comments || []);
    }
  );
});

// 发布评论
app.post('/api/posts/:id/comments', authenticateToken, (req, res) => {
  const { content } = req.body;
  const postId = req.params.id;

  if (!content) {
    return res.status(400).json({ error: '评论内容不能为空' });
  }

  db.run(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
    [postId, req.user.id, content],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '发布评论失败' });
      }

      // Broadcast new comment via WebSocket
      io.emit('new_comment', {
        id: this.lastID,
        post_id: postId,
        user_id: req.user.id,
        username: req.user.username,
        content,
        created_at: new Date()
      });

      res.status(201).json({ 
        message: '评论发布成功',
        id: this.lastID
      });
    }
  );
});

// ===== WebSocket Events =====
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });

  // 用户加入特定帖子
  socket.on('join_post', (postId) => {
    socket.join(`post_${postId}`);
    socket.emit('joined_post', { postId });
  });

  // 离开帖子
  socket.on('leave_post', (postId) => {
    socket.leave(`post_${postId}`);
  });

  // 实时评论（仅发送给该帖子的用户）
  socket.on('post_comment', (data) => {
    io.to(`post_${data.postId}`).emit('comment_added', data);
  });
});

// ===== Error Handler =====
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器错误' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
