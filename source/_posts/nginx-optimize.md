---
title: Nginx 优化
tags:
  - 面试
date: 2025-06-23 18:15:47
categories: 理论知识
---

### 优化清单

1. 调整连接数限制

```nginx
events {
  use epoll;                # 使用高效的事件模型（Linux 推荐）
  worker_connections 10240; # 单个 worker 最大连接数
}
```

<!-- more -->

2. 启用 keepalive 提升连接复用效率

```nginx
upstream backend {
    server 127.0.0.1:8080;
    keepalive 32; # 保持后端连接数
}

location / {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}
```

3. 启用缓存减少后端压力

```nginx
location ~ \.(jpg|jpeg|png|gif|css|js)$ {
    expires 7d;             # 设置静态资源缓存时间
    add_header Cache-Control "public";
    access_log off;         # 关闭日志记录
}
```

4. 开启 Gzip 压缩提升传输效率

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_min_length 1024;
gzip_comp_level 6;
```