---
title: 一台新的 Linux 服务器加固
tags:
  - 面试
date: 2025-06-23 18:20:47
categories: 理论知识
---

### 优化清单

1. 更新系统软件包
2. 设置主机名和DNS解析
3. 配置时区 & 安装时间同步服务
4. 禁用 root 登录, 使用普通用户加 sudo 
<!-- more -->
5. 配置防火墙
6. 配置 Fail2Ban, 防止密码破解
7. 安装 auditd, 日志审计
8. 调整内核参数

   |参数|描述|
   |:---:|:---:|
   | net.ipv4.tcp_tw_reuse = 1|允许重用 TIME_WAIT 状态的 TCP 端口|
   | net.ipv4.tcp_tw_recycle = 0|禁止重用 TIME_WAIT 状态的 TCP 端口|
   | net.ipv4.tcp_fin_timeout = 30|设置 TIME_WAIT 状态的 TCP 端口的关闭时间|
   | net.ipv4.tcp_keepalive_time = 600|设置 TCP 链接的 keepalive 时间|
   | net.core.somaxconn = 2048|设置 TCP 链接的队列长度|
   | vm.swappiness = 10|设置 swap 的优先级|
   | fs.file-max = 1000000|设置文件句柄数|