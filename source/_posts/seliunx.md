---
title: 关于seliunx的学习过程
date: 2023-05-24 22:02:47
categories: 学习过程
tags:
  - Linux
---

### 修改文件SELinux的上下文

#### 实验目的：修改文件的selinux上下文标签，把`/home/student`目录的selinux上下文标签替换为`/root`目录的selinux上下文标签。

 * 查看student目录的selinux

```bash
[root@servera home]# ls -dZ student/
unconfined_u:object_r:user_home_dir_t:s0 student/
```

<!-- more -->

**user_home_dir_t**的部分就是`/home/student`的selinux的上下文。

 * 查看root目录的selinux

```bash
[root@servera /]# ls -Zd /root/
system_u:object_r:admin_home_t:s0 /root/
```

**admin_home_t**的部分就是`/root`的selinux的上下文。

* 修改命令

```bash
[root@servera /]# semanage fcontext -a -t admin_home_t '/home/student(/.*)?'
```

`'/home/student(/.*)?'`部分后面的`(/.*)?`是固定的。

* 使配置生效

```bash
[root@servera /]# restorecon -RFvv /home/student/
Relabeled /home/student from unconfined_u:object_r:user_home_dir_t:s0 to system_u:object_r:admin_home_t:s0
Relabeled /home/student/.bash_logout from unconfined_u:object_r:user_home_t:s0 to system_u:object_r:admin_home_t:s0
Relabeled /home/student/.bash_profile from unconfined_u:object_r:user_home_t:s0 to system_u:object_r:admin_home_t:s0
Relabeled /home/student/.bashrc from unconfined_u:object_r:user_home_t:s0 to system_u:object_r:admin_home_t:s0
Relabeled /home/student/.ssh from unconfined_u:object_r:ssh_home_t:s0 to system_u:object_r:admin_home_t:s0
Relabeled /home/student/.ssh/known_hosts from unconfined_u:object_r:ssh_home_t:s0 to system_u:object_r:admin_home_t:s0
Relabeled /home/student/.ssh/authorized_keys from unconfined_u:object_r:ssh_home_t:s0 to system_u:object_r:admin_home_t:s0
Relabeled /home/student/.bash_history from unconfined_u:object_r:user_home_t:s0 to system_u:object_r:admin_home_t:s0

```

* 再次查看student目录的selinux

```bash
[root@servera /]# ls -dZ /home/student/
system_u:object_r:admin_home_t:s0 /home/student/
```

发现student目录的selinux值变成了**admin_home_t**。

---