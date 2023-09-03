---
title: Git 的基本操作
date: 2023-03-13 12:00:00
categories: 
  - 探索
  - 学习过程
tags: 
  - Git
---

添加修改到暂存区

```git
git add .
```

添加提交说明

```git
git commit -m "modify file1"
```

把本地修改推送到远程仓库

<!-- more -->

```git 
git push origin main
```
>PS：main 代表是远程分支的名字，远程分支叫什么就填什么。

克隆仓库

```git 
git clone "your link"
```
>PS：克隆下来的仓库和下载下来的源代码解压出来的效果是不一样的，最直接的不同是：克隆会产生一个隐藏的.git 文件，而解压不会产生这个文件。

同步远程分支

```git
git pull
```

删除push和fetch地址

```git 
git remote rm origin
```

添加push和fetch地址

```git
git remote add origin
```

列出所有的分支(包括本地分支和远程分支)

```git
git branch -a
```

在本地切换分支

```git 
git checkout "branch name"
```

在本地创建分支

```git 
git checkout -b "branch name"
```

>PS：这个命令在创建分支的同时也会将当前分支切换过去

修改本地分支名字

```git 
git branch -m "old branch name" "new branch name"
```

删除本地分支

```git
git branch -d "branch name"
```

删除远程分支

```git 
git push origin --delete "remote branch name"
```