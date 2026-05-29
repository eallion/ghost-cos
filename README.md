# Ghost COS Storage

腾讯云对象存储 (COS) 适配器，用于 Ghost 6.42.x+。支持将 Ghost 上传的图片存储到腾讯云 COS，并可通过自定义 CDN 域名访问。

## 功能特性

- ✅ 完全支持 Ghost 6.42.x+
- ✅ 支持图片上传、读取
- ✅ 支持自定义 CDN 域名
- ✅ 支持自定义存储路径
- ✅ 双命名策略：原始文件名（转写+冲突检测）或内容 Hash 去重
- ✅ Docker 镜像预装适配器，不受 volume 覆盖

## 安装方式

### 方式一：使用 Docker 镜像（推荐）

```bash
docker pull eallion/ghost:6-alpine
```

### 方式二：通过 Git 安装（非 Docker 环境）

```bash
mkdir -p content/adapters/storage
cd content/adapters/storage
git clone https://github.com/eallion/ghost-cos.git ghost-cos
cd ghost-cos
npm install --production
```

## 配置方法

### 方法一：Ghost 配置文件

编辑 `config.production.json`：

```json
{
  "storage": {
    "active": "ghost-cos",
    "ghost-cos": {
      "SecretId": "你的 SecretId",
      "SecretKey": "你的 SecretKey",
      "Bucket": "存储桶名称-APPID",
      "Region": "存储桶地域，如 ap-chengdu",
      "baseUrl": "自定义 CDN 域名，如 https://cdn.example.com",
      "basePath": "/ghost/content/images/",
      "rename": false,
      "forcePathStyle": false
    }
  }
}
```

### 方法二：Ghost 原生环境变量

Ghost 支持通过环境变量覆盖配置，格式为 `storage__配置项`：

```bash
storage__active=ghost-cos
storage__ghost-cos__SecretId=你的 SecretId
storage__ghost-cos__SecretKey=你的 SecretKey
storage__ghost-cos__Bucket=存储桶名称-APPID
storage__ghost-cos__Region=存储桶地域
storage__ghost-cos__baseUrl=自定义 CDN 域名
storage__ghost-cos__basePath=/ghost/content/images/
storage__ghost-cos__rename=false
storage__ghost-cos__forcePathStyle=false
```

## Docker 使用

### 构建镜像

```bash
docker build --no-cache -t eallion/ghost:6-alpine .
```

### 运行容器

```bash
docker run -d \
  --name ghost \
  -p 2368:2368 \
  -e storage__active=ghost-cos \
  -e storage__ghost-cos__SecretId=your-secret-id \
  -e storage__ghost-cos__SecretKey=your-secret-key \
  -e storage__ghost-cos__Bucket=your-bucket-123456 \
  -e storage__ghost-cos__Region=ap-chengdu \
  -e storage__ghost-cos__baseUrl=https://cdn.example.com \
  -e storage__ghost-cos__rename=false \
  -v ghost-content:/var/lib/ghost/content \
  eallion/ghost:6-alpine
```

> ⚠️ 注意：适配器安装在 `current/core/server/adapters/storage/`，不受 `/var/lib/ghost/content` 挂载影响。你可以自由挂载整个 `content/` 目录。

### Docker Compose

创建 `docker-compose.yml`：

```yaml
services:
  ghost:
    image: eallion/ghost:6-alpine
    container_name: ghost
    restart: always
    env_file:
      - .env
    environment:
      NODE_ENV: production
      url: https://your-domain.com
      admin__url: https://your-domain.com
      labs__publicAPI: true
      database__client: mysql
      database__connection__host: db
      database__connection__user: ${DATABASE_USER:-ghost}
      database__connection__password: ${DATABASE_PASSWORD:?DATABASE_PASSWORD environment variable is required}
      database__connection__database: ghost
      storage__active: ghost-cos
      storage__ghost-cos__SecretId: ${COS_SECRET_ID}
      storage__ghost-cos__SecretKey: ${COS_SECRET_KEY}
      storage__ghost-cos__Bucket: ${COS_BUCKET}
      storage__ghost-cos__Region: ${COS_REGION}
      storage__ghost-cos__baseUrl: ${CDN_URL:-}
      storage__ghost-cos__basePath: /ghost/content/images/
      storage__ghost-cos__rename: false
      storage__ghost-cos__forcePathStyle: false
    volumes:
      - ${UPLOAD_LOCATION:-./data/ghost}:/var/lib/ghost/content
    depends_on:
      db:
        condition: service_healthy
    networks:
      - ghost_network
    deploy:
      resources:
        limits:
          memory: 256M

  db:
    image: mysql:8.0
    container_name: ghost-db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD environment variable is required}
      MYSQL_DATABASE: ghost
      MYSQL_USER: ${DATABASE_USER:-ghost}
      MYSQL_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - ghost_network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 256M

networks:
  ghost_network:

volumes:
  mysql-data:
```

创建 `.env` 文件：

```bash
# Ghost 配置
DOMAIN=your-domain.com

# Database
MYSQL_ROOT_PASSWORD=ghost
DATABASE_USER=ghost
DATABASE_PASSWORD=ghost

# Data locations
UPLOAD_LOCATION=./data/ghost
MYSQL_DATA_LOCATION=./data/mysql

# 腾讯云 COS 配置
COS_SECRET_ID=your-secret-id
COS_SECRET_KEY=your-secret-key
COS_BUCKET=your-bucket-123456
COS_REGION=ap-shanghai
CDN_URL=https://images.example.com
```

启动：

```bash
docker-compose up -d
```

> ⚠️ 适配器安装在 `current/core/server/adapters/storage/`，不受 `content/` 挂载影响。`volumes` 中的 `${UPLOAD_LOCATION:-./data/ghost}` 目录可自由绑定。

## 配置参数说明

| 参数 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `SecretId` | 是 | 腾讯云 SecretId | - |
| `SecretKey` | 是 | 腾讯云 SecretKey | - |
| `Bucket` | 是 | 存储桶名称（格式：名称-APPID） | - |
| `Region` | 是 | 存储桶地域（如 ap-chengdu） | - |
| `baseUrl` | 否 | 自定义 CDN 域名（支持多种格式：`https://xxx.com`、`xxx.com`、`https://xxx.com/`、`xxx.com/`） | 空（使用 COS 默认域名） |
| `basePath` | 否 | 存储路径前缀 | `/ghost/content/images/` |
| `rename` | 否 | 文件名策略：`true`=内容 Hash 去重，`false`=原文件名转写+冲突检测 | `false` |
| `forcePathStyle` | 否 | 是否强制使用 path-style 域名（2024 年后创建的存储桶请设为 `false`） | `false` |
| `timeout` | 否 | COS 请求超时时间（毫秒） | `30000` |

> **命名策略说明：**
> - `rename: true` — 内容 Hash（MD5 前 12 位）+ 原始扩展名，相同内容自动去重（如 `伞耀分类-伞耀1.jpg` → `a1b2c3d4e5f6.jpg`）
> - `rename: false`（默认）— 中文/日文转拼音/罗马字 + 冲突时自动追加 `-1`、`-2`（如 `伞耀分类-伞耀1.jpg` → `sanyaofenlei-sanyao_1.jpg`，重名 → `sanyaofenlei-sanyao_1-1.jpg`）

## 获取腾讯云密钥

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 访问 [访问管理](https://console.cloud.tencent.com/cam/capi)
3. 创建或查看 API 密钥

## 获取存储桶信息

1. 登录 [对象存储控制台](https://console.cloud.tencent.com/cos)
2. 创建存储桶或查看已有存储桶
3. 存储桶名称格式：`bucket-name-appid`
4. 地域代码如：`ap-chengdu`、`ap-shanghai`、`ap-beijing`

## GitHub Actions

项目包含 GitHub Actions 工作流，可自动构建并推送 Docker 镜像到 Docker Hub 和 GitHub Container Registry。

### 触发方式

- 推送 `v*` 标签时自动构建
- 手动触发 workflow dispatch

### 配置

在 GitHub 仓库 Settings > Secrets 中添加：

- `DOCKERHUB_USERNAME` - Docker Hub 用户名
- `DOCKERHUB_TOKEN` - Docker Hub Access Token

## 常见问题

### Q: 图片上传后无法访问？

A: 检查 `baseUrl` 是否正确配置为你的 CDN 域名，确保域名已解析到 COS 存储桶。

### Q: 如何使用自定义域名？

A: 在腾讯云 COS 控制台配置自定义域名，然后将 `baseUrl` 设置为你的域名。

### Q: 支持哪些图片格式？

A: 支持 Ghost 支持的所有图片格式：JPG、PNG、GIF、WebP、SVG 等。

## License

MIT
