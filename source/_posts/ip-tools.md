---
title: 命令行IP工具
date: 2023-09-28 17:39:42
categories: 小玩意儿
tags:
  - 工具
  - Windows
---

### curl 指定 IPv6 或 IPv4 访问

如果同一个 host 同时解析到 IPv6 和 IPv4 地址，即 IPv4/IPv6 双栈，则 curl 使用参数可指定 IP 协议的版本。

```bash
curl -4 test.ipw.cn
106.224.145.147

curl -6 test.ipw.cn
2408:824c:200::2b8b:336f:cc9c
```

<!-- more -->

###  IPV4 OR IPV6 优先？

```bash
curl test.ipw.cn
```

PS：实测验证：这个命令行工具即使返回IPV6也不代表就是IPV6优先了，还是通过网页验证比较靠谱。

打开 [https://test.ipw.cn/](https://test.ipw.cn/)，如果返回的 IPVersion 字段为 IPv6，则当前网络 IPv6 访问优先，如果返回的 IPVersion 字段为 IPv4，则当前网络 IPv4 访问优先。

### 验证IPV6

1. 网页访问验证

这是一个 [IPv6 地址查询](https://ipw.cn/ipv6/) 的网站，可以看到上面提示 您的网络 IPv6 访问优先。

也可以对自己的公网 IPv6 地址进行 [在线 Ping](https://ipw.cn/ipv6ping/)。

2. 域名访问验证

打开 [https://6.ipw.cn/](https://6.ipw.cn/)，如果能访问成功，那么证明 IPv6 网络开启成功。

3. IPv6 地址直接访问

若成功开启IPV6，可以直接成功访问`http://[2402:4e00:1013:e500:0:9671:f018:4947]/`，会返回如下信息。

```bash
// http://[2402:4e00:1013:e500:0:9671:f018:4947]/
240e:3b7:3b7:3b7::3b7
```

