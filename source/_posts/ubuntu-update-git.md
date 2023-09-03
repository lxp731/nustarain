---
title: Ubuntu 升级Git版本
date: 2023-03-26 22:53:00
categories: 
  - 探索
tags:
  - Git
  - Ubuntu
---

Ubuntu自己带的git的版本可以正常使用，但是出于对完美的追求，还是想将Git升级为相对高一点的版本。

只需要依次执行以下代码就OK了。

```bash
sudo add-apt-repository ppa:git-core/ppa
sudo apt-get update
sudo apt-get install git
```

执行完事后，可以通过以下命令查看Git的版本。

```bash
git --veision
```

<!-- more -->

>节选自SCDN诸葛_瓜皮的文章
>https://blog.csdn.net/Ezreal_King/article/details/79999131
>记录本文章纯粹是为了之后自己方便寻找