# NodeSeek 社区论坛 - 全栈应用

一个完整的社区论坛平台，包含用户认证、实时评论、WebSocket 通信等功能。

## 功能特性

✅ **用户系统**
- 用户注册和登录
- JWT 令牌认证
- 密码加密存储

✅ **帖子管理**
- 发布、浏览、分类帖子
- 浏览统计
- 多分类支持

✅ **实时评论**
- 实时评论推送（Socket.IO）
- 评论列表加载
- 用户认证评论

✅ **其他功能**
- 响应式设计
- 实时通知
- 用户菜单

## 项目结构

```
nodeseek-forum/
├── server.js              # Express 后端服务器
├── package.json           # 项目依赖
├── .env                   # 环境变量
├── forum.db               # SQLite 数据库（自动生成）
└── public/
    └── index.html         # 前端应用
```

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 运行服务器

```bash
npm start
```

或者使用 nodemon 进行开发（自动重启）：

```bash
npm run dev
```

### 3. 打开应用

在浏览器中访问：
```
http://localhost:5000
```

## API 端点

### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 帖子
- `GET /api/posts` - 获取帖子列表
- `GET /api/posts?category=分类名` - 按分类筛选
- `POST /api/posts` - 发布新帖（需认证）
- `GET /api/posts/:id` - 获取帖子详情

### 评论
- `GET /api/posts/:id/comments` - 获取帖子评论
- `POST /api/posts/:id/comments` - 发布评论（需认证）

## 数据库

使用 SQLite3，自动创建以下表：

### users 表
- id: 用户ID
- username: 用户名
- email: 邮箱
- password: 加密密码
- avatar: 头像字符
- created_at: 创建时间

### posts 表
- id: 帖子ID
- user_id: 用户ID
- title: 标题
- content: 内容
- category: 分类
- views: 浏览数
- created_at: 创建时间

### comments 表
- id: 评论ID
- post_id: 帖子ID
- user_id: 用户ID
- content: 评论内容
- created_at: 创建时间

## 安全性

- 使用 bcryptjs 进行密码加密
- 使用 JWT 进行令牌认证
- 跨域请求支持（CORS）
- SQL 注入防护

## 实时功能

使用 Socket.IO 实现实时通信：
- `new_post` - 新帖子发布事件
- `new_comment` - 新评论事件
- `join_post` - 用户加入帖子
- `leave_post` - 用户离开帖子

## 环境配置

编辑 `.env` 文件：

```
PORT=5000
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
```

## 常见问题

**Q: 如何重置数据库？**
A: 删除 `forum.db` 文件，重新启动服务器会自动创建新数据库。

**Q: 如何修改 JWT_SECRET？**
A: 在 `.env` 文件中修改 `JWT_SECRET` 值（生产环境必改）。

**Q: WebSocket 连接失败？**
A: 确保服务器运行在 http://localhost:5000，检查防火墙设置。

## 技术栈

- **后端**: Node.js + Express.js
- **数据库**: SQLite3
- **认证**: JWT + bcryptjs
- **实时通信**: Socket.IO
- **前端**: Vanilla JavaScript + HTML5/CSS3
- **CORS**: 跨域资源共享

## 示例用户

初次使用可以创建测试账户：
- 用户名: testuser
- 邮箱: test@example.com
- 密码: password123

## 许可证

MIT
