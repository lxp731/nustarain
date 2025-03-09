---
title: NGINX配置的那些事
date: 2024-04-02 14:27:45
categories: 技术
tags:
  - NGINX
  - Linux
---

知道的越多，不知道的越多，NGINX的功能远比我所能理解的多太多了。  
山高万仞，只登一步。披荆斩棘，行则将至。

<!-- more -->

### NGINX端口重定向（80 to 443）

在生产环境中，一般不会使用http协议进行Web访问，都是使用https加密的方式进行Web访问，http和https各自监听的端口都不一样，那多余的80端口，该何去何从？一个比较合适的做法是端口重定向，使用NGINX的重写功能，将访问80端口的请求自动转发给443端口，下面是一个例子：

```bash 折叠代码
server {
    # HTTPS的默认访问端口443。如果未在此处配置HTTPS的默认访问端口，可能会造成Nginx无法启动。
    listen 443 ssl;
     
    # 填写证书绑定的域名
    server_name itellyou.cf;
 
    # 关于配置SSL证书的部分，保证证书路径正确，其他保持不变即可
    ssl_certificate /opt/ssl/itellyou.cf.pem;
    ssl_certificate_key /opt/ssl/itellyou.cf.key;
    ssl_session_cache shared:SSL:1m;
    ssl_session_timeout 5m;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        root /usr/share/nginx/html;
        index index.php index.html index.htm;
    }
}

server {
    listen 80;
    #填写证书绑定的域名
    server_name itellyou.cf;
    #将所有HTTP请求通过rewrite指令重定向到HTTPS。
    rewrite ^(.*)$ https://$host$1;
    location / {
        index index.php index.html index.htm;
    }
}
```

### NGINX反向代理

#### 反向代理不加密站点

```bash 折叠代码
server {
    # 配置http要监听80端口
    listen 80;
    # 确保DNS厂商已经正确解析域名
    server_name ai.itellyou.cf;

    # 填写正确的后端代理地址
    location / {
        proxy_pass http://itellyou.cf:30080;
    }
}
```

#### 反向代理SSL加密站点

```bash 折叠代码
server {
    # 配置https要监听443端口
    listen 443 ssl;
    # 确保DNS厂商已经正确解析域名
    server_name ai.itellyou.cf;
 
    # 关于配置SSL证书的部分，保证证书路径正确，其他保持不变即可
    ssl_certificate /opt/ssl/ai.itellyou.cf.pem;
    ssl_certificate_key /opt/ssl/ai.itellyou.cf.key;
    ssl_session_cache shared:SSL:1m;
    ssl_session_timeout 5m;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
    ssl_protocols TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # 填写正确的后端代理地址
    location / {
        proxy_pass http://itellyou.cf:30080;
    }
}
```