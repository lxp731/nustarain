---
title: 激活Windows
date: 2024-06-01 22:06:56
categories: 小玩意儿
tags:
  - Windows
---

激活windows的几种办法，后续会逐步更新不同的激活方法。

### CMD命令激活

第一步：<kbd>Win</kbd>+<kbd>Q</kbd>搜索CMD，以管理员身份运行。

<!-- more -->

第二步：输入命令 slmgr.vbs /upk ，稍等片刻会提示：“已成功卸载了产品密钥”；

第三步：输入命令 slmgr /ipk W269N-WFGWX-YVC9B-4J6C9-T83GX ，稍等片刻会提示：“成功的安装了产品密钥”；

第四步：输入命令 slmgr /skms zh.us.to ，稍等片刻会提示：“密钥管理服务计算机名成功的设置为zh.us.to”；

第五步：输入 命令 slmgr /ato ，会提示：“成功的激活了产品”；

```bash
slmgr.vbs /upk
slmgr /ipk W269N-WFGWX-YVC9B-4J6C9-T83GX
slmgr /skms zh.us.to
slmgr /ato
```

### KMS主机

[KMS主机列表，点击跳转](https://www.coolhub.top/tech-articles/kms_list.html)