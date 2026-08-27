---
title: Linux 运维面试问答（34 题）
date: 2026-08-27 09:00:00
categories: 技术
password: buzhidao
tags:
  - Linux
  - 面试
  - 私密

---

本文整理了Linux 运维面试问答（34 题）相关的 34 个高频面试问题，从基础到进阶再到生产实战层层递进，覆盖Linux、面试等核心考点，每题附参考回答与追问，适合面试前系统复习。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

---

## 一、岗位高频速查

| 岗位 | 必考问题与一句话要点 |
|---|---|
| 运维工程师 | 1. 磁盘/文件系统排查：`df -h`、`df -i`、`du`，inode 耗尽与被删未释放文件（lsof）<br>2. 进程与性能：`ps/top`、僵尸进程处理、CPU/内存/IO 定位（vmstat/iostat）<br>3. systemd 与日志：`systemctl` 服务管理、`journalctl` 查日志<br>4. 网络与端口：`ss -lntp`、`curl`、防火墙 firewalld/iptables 放行<br>5. LVM/RAID：在线扩容流程、坏盘更换 |
| 技术支持工程师 | 1. 基础排障 SOP：用户报障→复现→查日志→定位→解决→反馈<br>2. 服务/端口/权限类常见问题：`systemctl`、`ss`、`chmod`、`sudo`<br>3. 日志查看与导出：`journalctl`、`tail -f`、`grep` 定位关键字<br>4. 用户账号与密码：`passwd`、`usermod -aG`、解锁/锁定账号<br>5. 深度原理题：低频，了解即可 |
| AI 运维工程师 | 1. GPU 状态与卡死：`nvidia-smi`、`fuser -v /dev/nvidia*`、xid error<br>2. 训练任务长时运行：nohup/tmux、异常退出自动重启、日志留痕<br>3. 显存/内存 OOM：`nvidia-smi` 看显存占用、`dmesg` 看 OOM、调 batch_size/num_workers<br>4. 数据集存储与 IO：SSD/RAID 选型、随机读性能、`iostat` 监控<br>5. 驱动/CUDA 版本与容器：driver 与 CUDA 匹配、nvidia-docker/gpu 直通 |
| DevOps 工程师 | 1. Ansible：常用模块、幂等性、playbook 结构、批量与滚动更新<br>2. Shell 脚本与发布流程：备份→停服→替换→启动→健康检查→回滚<br>3. systemd 服务治理：自写 unit、资源限制 LimitNOFILE、开机自启<br>4. 配置版本化与回滚：git + ansible 管理配置，变更可回退<br>5. 监控告警：crontab + 脚本 + 告警通道（磁盘、CPU、端口、进程） |

---

## 二、基础篇（12 题）

### Q1. 硬链接和软链接有什么区别？各自用在什么场景？

- 【考察点】文件系统的底层理解——inode 与目录项的关系，这是 RHCE 必考、面试必问的基础分水岭题。
- 【参考回答】先给结论：硬链接是同一个 inode 的多个目录项，软链接是一个独立文件、里面存的是目标路径。硬链接用 `ln file hard` 创建，不能跨文件系统、不能对目录建；删除其中一个，数据还在，只有 inode 引用计数归零才真正释放。软链接用 `ln -s target link`，可以跨文件系统、可以指向目录，目标被删链接就失效（显示红字/闪烁）。生产里我最常用的就是软链接，比如 `/usr/bin/python -> python3`、日志切到别的盘；硬链接用的少，偶尔用于关键文件双份防误删，比如备份 `/etc/passwd` 的硬链接副本。
- 【追问】
  - **追问1：怎么查看一个文件的硬链接数？** 答：`ls -l` 第二列就是硬链接数，或者 `stat file` 看 Links 字段；目录的硬链接数至少是 2（自身加 `.`）。
  - **追问2：对目录能建硬链接吗？** 答：普通用户不行，文件系统禁止对目录建硬链接防止环；`ln -d` 只有 root 在某些场景（如备份工具）才用，日常绝对不用。
  - **追问3：软链接写绝对路径和相对路径有区别吗？** 答：有。`ln -s /opt/app/bin/start.sh /usr/bin/start` 存的是绝对路径，链接文件挪位置不影响；存相对路径的话，链接文件被挪动可能就失效了，所以生产上建议统一用绝对路径。
- 【岗位标注】通用 / 运维 / DevOps

### Q2. Linux 文件权限 rwx 和数字怎么对应？目录的 x 权限有什么用？

- 【考察点】权限模型基本功：数字权限换算、目录权限的特殊性、chmod/chown 的常见用法。
- 【参考回答】先给结论：r=4、w=2、x=1，三个一组加起来，所以 755 就是属主 rwx、属组 r-x、其他 r-x，644 是属主 rw-、其余 r--。目录和文件不一样：目录的 r 是能 `ls` 列出文件名，x 是能 `cd` 进去并访问里面的文件，所以目录权限为 700 时只有属主能进；要给目录写权限必须同时有 w 和 x，否则能建文件列表里也看不到。改权限用 `chmod 755 file` 或 `chmod u+x,g-w file`，递归 `-R`；改属主属组用 `chown user:group file`。生产上常用 `chown -R app:app /data/app` 这类。
- 【追问】
  - **追问1：一个文件是 644，属主想执行它怎么办？** 答：`chmod +x file` 或 `chmod 744`，执行脚本前一定要记得加 x，这是新手最常见的错。
  - **追问2：目录只有 r 权限没有 x，能做什么？** 答：能 `ls` 看到文件名，但 `ls -l` 的详细信息、`cd`、`cat` 文件全都不行，因为拿不到 inode 信息，这是个很容易答错的细节。
  - **追问3：chmod 数字权限下，怎么单独给属组加读权限？** 答：`chmod g+r file`，或者先 `stat -c %a file` 看当前值再换算成数字改。
- 【岗位标注】通用 / 技术支持

### Q3. SUID、SGID、Sticky bit 分别是什么？

- 【考察点】特殊权限位是否真的理解，而不是只背"s 和 t"。面试官常拿这个区分背题党和实操党。
- 【参考回答】先给结论：SUID 是"执行时以文件属主身份运行"，数字是 4，典型例子是 `passwd`（属主 root，普通用户执行时以 root 身份改 /etc/shadow）；SGID 是"执行时以文件属组身份运行"或"目录下新建文件自动继承目录属组"，数字是 2，团队共享目录常用；Sticky bit 是"目录里只有文件属主或 root 能删"，数字是 1，`/tmp` 就是典型。设置方法：`chmod u+s file`、`chmod g+s dir`、`chmod +t dir`，或者数字组合如 `chmod 4755`。生产里我的经验是：SUID 能不用就不用，它是提权风险点，安全扫描（比如 CVE 检查）会专门找带 SUID 的可疑二进制。
- 【追问】
  - **追问1：怎么找出系统里所有带 SUID 的文件？** 答：`find / -perm -4000 -type f 2>/dev/null`，定期审计一遍，这是安全基线的一部分。
  - **追问2：目录设了 SGID，新建的文件属组是什么？** 答：继承目录的属组而不是创建者的默认组，这就是共享目录（如 `/data/shared` 给 dev 组用）的标准做法。
  - **追问3：/tmp 的权限是什么样的？** 答：`drwxrwxrwt`，最后的 t 就是 sticky bit，所有人能写但只能删自己的文件，防止互相删临时文件。
- 【岗位标注】运维 / DevOps

### Q4. umask 是什么？怎么影响新建文件权限？

- 【考察点】默认权限的计算逻辑，以及临时改和永久改的区别。
- 【参考回答】先给结论：umask 是"默认权限掩码"，意思是新建文件时要从最大权限里减掉的值。文件最大 666、目录最大 777，umask 022 时文件就是 666-022=644，目录是 777-022=755。注意文件不会自动加执行位，所以 umask 022 建出来的文件是 rw-r--r-- 而不是 755。临时改：`umask 002`；永久改：写进 `/etc/profile` 或用户 `~/.bashrc`。生产上开发团队共用的目录常设 umask 002，让同组的人建的文件组内可写，配合前面说的 SGID 一起用。
- 【追问】
  - **追问1：umask 777 会怎样？** 答：文件 666-777 按位减完是 000，目录同理，建出来的东西谁都没权限，等于自锁，典型手误。
  - **追问2：怎么查看当前 umask 和默认值？** 答：`umask` 直接看；`umask -S` 看符号形式（u=rwx,g=rx,o=rx）；系统默认在 `/etc/profile`、`/etc/bashrc` 里定义。
- 【岗位标注】通用 / 技术支持

### Q5. 怎么用 ps、top 查看进程？top 里重点看哪些字段？

- 【考察点】进程查看工具的基本功：ps 常见组合、top 关键指标（load average、CPU 各态、内存列）是否真的看得懂。
- 【参考回答】先给结论：查进程用 `ps -ef` 或 `ps aux`（a 所有用户、u 显示用户和资源、x 显示无终端进程），要看树形父子关系用 `pstree`；实时监控用 `top`。`top` 里我重点看三块：第一行 load average 的 1/5/15 分钟均值，持续大于 CPU 核数说明过载；第二行进程数里有没有大量 zombie（僵尸）；第三行 %Cpu(s) 里 us 用户态、sy 系统态、wa IO 等待——wa 高说明瓶颈在磁盘。进程列表里按 P 按 CPU 排序、按 M 按内存排序，`top -Hp PID` 看某个进程的线程，`top -d 1` 调刷新间隔。htop 是 top 的增强版，支持鼠标、F5 树形视图、F6 排序，但很多生产服务器没装，所以 top 必须熟。
- 【追问】
  - **追问1：load average 多高算高？** 答：看 CPU 核数，`nproc` 看核数；load 持续超过核数就是排队了，比如 8 核机器 load 长期 10+ 肯定有问题，但还要结合 us/sy/wa 判断瓶颈在 CPU 还是 IO。
  - **追问2：top 里 RES 和 VIRT 有什么区别？** 答：VIRT 是虚拟内存（进程申请过的地址空间，含共享库），RES 是实际驻留物理内存，看内存占用以 RES 为准。
  - **追问3：怎么把 top 结果导出分析？** 答：`top -b -n 1` 批处理模式输出一次，配合 `-p PID` 可以采样监控，脚本里常用。
- 【岗位标注】通用 / 运维 / AI 运维

### Q6. 什么是僵尸进程？怎么产生的？怎么处理？

- 【考察点】进程生命周期理解：父子进程、wait 回收机制。运维现场高频问题。
- 【参考回答】先给结论：僵尸进程是子进程已经退出、但父进程没有调用 wait 回收它的退出状态，所以进程表里还留着一条 Z 状态记录。它不占 CPU 不占内存，但占用 PID 和内核进程表项，数量多了会导致 PID 耗尽、新进程起不来。处理顺序：先 `ps -ef | grep defunct` 或看 top 里 Z 状态确认，然后找它的父进程 PPID；僵尸是杀不掉的（它已经死了，`kill -9` 都没用），正确做法是处理父进程——要么通知开发修父进程的 wait 逻辑，要么 `kill` 父进程让它退出，僵尸会被 init/systemd（PID 1）收养并回收。个别情况父进程是 PID 1 还持续产生僵尸，那就得查那个服务的代码了。
- 【追问】
  - **追问1：僵尸进程和孤儿进程是一回事吗？** 答：不是。孤儿是父进程先死、子进程被 init 收养继续运行；僵尸是子进程先死、父进程没回收。孤儿不是问题，僵尸才是需要处理的。
  - **追问2：怎么快速统计系统里有多少僵尸？** 答：`ps -A -o stat,ppid,pid,cmd | grep -w Z`，或者 `top` 第二行 Tasks 里的 zombie 计数；`ps -A -o stat | grep -c '^Z'` 可以数个数。
- 【岗位标注】运维 / AI 运维

### Q7. kill 命令有哪些常用信号？kill -9 和 kill -15 有什么区别？

- 【考察点】信号机制理解与生产操作规范——动不动就 -9 是运维大忌，面试官要看你会不会先优雅终止。
- 【参考回答】先给结论：kill 默认发 SIGTERM(15)，让进程自己清理资源后退出；SIGKILL(9) 是强制杀，进程无法捕获无法清理。生产上我的原则是：先 `kill PID`（15），等几秒看进程没退、且确认它卡死了，才 `kill -9`；直接 -9 可能留下临时文件、数据库脏数据、锁没释放，比如 MySQL 被 -9 之后经常要恢复很久。其他常用：`kill -1`(HUP) 让守护进程重读配置（nginx -s reload 就是这个原理）、`kill -0` 探测进程是否存活（不发信号，脚本里用来做健康检查）。批量场景用 `pkill -f 关键字` 按命令行匹配、`killall 进程名`。
- 【追问】
  - **追问1：kill -9 一个进程后，端口为什么还占着？** 答：端口可能被别的进程占（确认 `ss -lntp`），或者该进程还有子进程/线程没退完，用 `ss -lntp` 再确认一下实际占用者。
  - **追问2：什么情况下必须用 -9？** 答：进程卡在 D 状态以外的死循环、无响应信号处理、或者脚本里要保证杀掉（但先给 15 再给 9 更稳，比如 `kill PID; sleep 5; kill -9 PID`）。
  - **追问3：SIGKILL 能被忽略吗？** 答：不能，这是它与 SIGTERM 的本质区别；所以 -9 是最后手段。
- 【岗位标注】通用 / 技术支持

### Q8. systemd 怎么管理服务？开机自启怎么设置？

- 【考察点】现代 Linux 服务管理的核心：systemctl 全套操作、enable/start 的区别、mask 等冷门操作。
- 【参考回答】先给结论：`systemctl start/stop/restart/status 服务名` 是日常四件套；开机自启是 `systemctl enable 服务名`，立即启动加 `--now`。查看运行状态用 `systemctl status sshd`（会直接显示运行状态、PID、最近日志，非常方便），批量看用 `systemctl list-units --type=service --state=running`。还有两个容易忽略的：`systemctl reload` 是热重载配置（服务要支持才行，比如 nginx、sshd），`systemctl mask` 是彻底禁用（连手动启动都禁止，常用于屏蔽某些会被依赖拉起来的服务）。改完 unit 文件一定要 `systemctl daemon-reload` 再 restart，否则不生效——这是新手最常踩的坑。
- 【追问】
  - **追问1：enable 和 start 有什么区别？** 答：enable 只是创建开机启动的软链接（WantedBy），当前不启动；start 是立即启动，不保证开机自启；所以新服务通常两个都要。
  - **追问2：服务起不来，第一步看什么？** 答：`systemctl status 服务名` 看有没有报错和错误日志，然后 `journalctl -u 服务名 -n 50` 看详细日志，基本 90% 的问题能从这里定位。
  - **追问3：怎么确认一个服务是不是开机自启？** 答：`systemctl is-enabled 服务名`，返回 enabled/disabled/static。
- 【岗位标注】通用 / 运维 / DevOps

### Q9. journald 日志怎么查？journalctl 常用参数有哪些？

- 【考察点】systemd 配套日志体系的实操熟练度——会不会按服务、按时间、按级别过滤。
- 【参考回答】先给结论：journald 是 systemd 的日志服务，`journalctl` 是查询命令。我最常用的组合：`journalctl -u sshd` 看某个服务的全部日志、`-f` 实时跟踪、`-n 100` 只看最近 100 行、`--since "1 hour ago"` 或 `--since today` 按时间过滤、`-p err` 只看错误及以上级别、`-k` 看内核日志。排查一次"服务半夜挂掉"的经典命令就是 `journalctl -u 服务名 --since "yesterday 00:00" -p err -n 50`。日志默认存在内存 `/run/log/journal`，重启就没了，要持久化得建 `/var/log/journal` 目录并设置 `Storage=persistent`（在 `/etc/systemd/journald.conf` 里）；日志占太多磁盘可以 `journalctl --vacuum-size=200M` 或 `--vacuum-time=30d` 清理。
- 【追问】
  - **追问1：日志文件在哪，占多少空间？** 答：`journalctl --disk-usage` 看占用；位置分内存 `/run/log/journal` 和持久化 `/var/log/journal`。
  - **追问2：程序直接输出到 stdout 的日志能被 journald 收集吗？** 答：能，标准输出/错误会被 systemd 捕获进 journald，这也是 `journalctl -u` 能查到它们的原因，所以写服务时日志打到 stdout 就够，不用自己写文件。
  - **追问3：除了 journald，传统日志怎么看？** 答：`/var/log/messages`（系统日志）、`/var/log/secure`（认证日志，sudo、ssh 登录都在这里）、`/var/log/cron`、`/var/log/dmesg`，老系统或 rsyslog 配置的系统仍然写这些文件。
- 【岗位标注】通用 / 运维 / 技术支持

### Q10. crontab 怎么写定时任务？有哪些常见的坑？

- 【考察点】定时任务五段格式、环境变量坑、日志与重定向习惯——每个运维都写过 crontab，但坑只有踩过的人知道。
- 【参考回答】先给结论：`crontab -e` 编辑、`-l` 查看、`-r` 删除，五段分别是分 时 日 月 周。典型例子：`0 2 * * * /opt/scripts/backup.sh >> /var/log/backup.log 2>&1` 每天凌晨两点跑备份。最大的坑有三个：第一，cron 环境变量和登录 shell 不一样，PATH 很窄，脚本里最好用绝对路径或开头 `source /etc/profile`；第二，命令输出默认会发邮件给 root（没配邮件就攒在 `/var/spool/mail` 里把磁盘写满），所以每条任务都要重定向 `>/dev/null 2>&1` 或写日志文件；第三，周和日都设了是"或"关系不是"与"（比如 `0 0 1 * 1` 是每月 1 号或每周一都执行）。查执行记录看 `/var/log/cron`，常见排查是"脚本手动能跑、定时不跑"——多半就是环境变量或路径问题。
- 【追问】
  - **追问1：怎么实现"每 5 分钟执行一次"？** 答：`*/5 * * * *`，分钟位用步长；注意 `*/5` 从 0 开始，即 0,5,10...55。
  - **追问2：crontab 里的命令带 % 怎么办？** 答：% 在 crontab 里有特殊含义（表示换行、用于 date 命令），要转义成 `\%`，比如 `date +\%F`，这是很多人不知道的细节。
  - **追问3：任务里想用相对路径的文件怎么办？** 答：脚本第一行加 `cd /opt/scripts` 或 `export` 相关路径，绝对路径最保险。
- 【岗位标注】运维 / DevOps

### Q11. 怎么创建用户、把用户加入 sudo 组？

- 【考察点】用户管理命令链和 sudo 提权机制：useradd 参数、wheel 组、visudo 与 sudoers 语法检查。
- 【参考回答】先给结论：创建用户 `useradd -m -s /bin/bash zhangsan`（-m 建家目录、-s 指定 shell），设密码 `passwd zhangsan`，加 sudo 权限最标准的做法是 `usermod -aG wheel zhangsan`（RHEL/CentOS 系的 wheel 组在 sudoers 里默认有 ALL=(ALL) ALL 权限），改完让他重新登录生效。改 sudo 配置必须用 `visudo` 编辑 `/etc/sudoers`，因为 visudo 会做语法检查，写错了保存时直接报错，不会把自己锁死——如果真锁死了，用 `pkexec visudo` 从图形/系统层面修复。查看用户自己的 sudo 权限用 `sudo -l`。生产上我一般限制普通用户只能执行特定命令，比如 `zhangsan ALL=(ALL) /usr/bin/systemctl restart nginx`，而不是给 ALL。
- 【追问】
  - **追问1：sudo 和 su 有什么区别？** 答：su 是切换用户（要目标用户密码），sudo 是以其他身份执行单条命令（要自己的密码，且受 sudoers 管控），生产上强制用 sudo，root 密码尽量不流通。
  - **追问2：怎么禁止某用户用 sudo？** 答：从 sudoers 里删掉它的授权行，或者 `usermod -G 其他组 zhangsan` 把它移出 wheel 组（注意 -G 会覆盖，用 `-aG` 追加）。
  - **追问3：visudo 保存时报语法错误怎么办？** 答：visudo 默认会用临时文件 + 校验，出错可以 `e` 重新编辑或 `q` 退出不保存，安全设计；配置改完用 `visudo -c` 验证一遍。
- 【岗位标注】通用 / 技术支持

### Q12. firewalld 和 iptables 怎么放行端口？有什么区别？

- 【考察点】防火墙实操：firewalld 的 --permanent/--reload 机制、iptables 规则增删查，以及两者关系。
- 【参考回答】先给结论：CentOS 7+ 默认是 firewalld，它底层其实还是 netfilter/iptables，只是多了一层 zone 管理。firewalld 放行端口：`firewall-cmd --add-port=8080/tcp --permanent && firewall-cmd --reload`，注意两点——不加 `--permanent` 只是临时生效、重启就没了；改完必须 `--reload` 才生效。查状态 `firewall-cmd --list-all`、`firewall-cmd --state`。iptables 是直接操作规则链：`iptables -I INPUT -p tcp --dport 80 -j ACCEPT` 插到最前面，`-L -n --line-numbers` 带行号查看，`-D INPUT 3` 按行号删除，保存用 `service iptables save`（CentOS 7 要装 iptables-services）。生产里最常见的故障"端口明明在监听却连不上"，第一反应就是查防火墙有没有放行。
- 【追问】
  - **追问1：firewall-cmd 和 iptables 能混用吗？** 答：不建议。firewalld 管理时会重写规则，手工 iptables 加的规则可能被覆盖或冲突；二选一，新系统用 firewalld，老脚本环境用 iptables。
  - **追问2：怎么临时放行一个 IP 而不是端口？** 答：firewalld：`firewall-cmd --add-rich-rule='rule family=ipv4 source address=10.0.0.5 accept'`；iptables：`-A INPUT -s 10.0.0.5 -j ACCEPT`。
  - **追问3：怎么确认端口到底是被防火墙挡还是服务没起？** 答：先 `ss -lntp | grep 端口` 确认在监听，再 `firewall-cmd --list-all` 看有没有放行，本机 `curl` 通、外部不通，基本就是防火墙或安全组。
- 【岗位标注】运维 / 技术支持

---

## 三、进阶篇（12 题）

### Q1. inode 是什么？磁盘明明有空间却报"No space left on device"是怎么回事？

- 【考察点】文件系统元数据机制的真正理解：inode 耗尽、df/du 不一致这两个经典生产问题，能问出真水平。
- 【参考回答】先给结论：inode 是文件的"档案"，存权限、属主、大小、时间戳和数据块指针，文件名只是目录里指向 inode 的条目；磁盘满分两种——块空间满（`df -h` 100%）和 inode 满（`df -i` 100%），后者就是"有空间但建不了文件"，常见于大量小文件场景：比如邮件队列、`/tmp` 缓存、日志切分产生海量碎片文件、docker 容器 overlay 层。排查命令：`df -i` 看 inode 使用率，`find / -xdev -type f | wc -l` 数文件个数，定位到目录后清理或迁移。还有一个经典反直觉场景：`df -h` 显示 100% 但 `du -sh /*` 加起来远小于总量——那是文件被 `rm` 删了但仍有进程持有句柄，空间没释放，用 `lsof | grep deleted` 找到进程重启即可。
- 【追问】
  - **追问1：怎么提前预防 inode 耗尽？** 答：监控里加上 `df -i` 指标；小文件多的目录（如缓存）做定期清理策略；日志保证 logrotate 正常轮转；分区规划时考虑小文件场景。
  - **追问2：inode 数量创建分区时能改吗？** 答：`mkfs.ext4 -N 指定数量` 可以，但一般按默认；xfs 的 inode 是动态分配，小文件压力比 ext4 小。
  - **追问3：df 和 du 数值应该相等吗？** 答：不完全，du 统计的是文件大小、不含元数据和被删未释放的块，df 是块设备视角；两者差得离谱时重点查 deleted 文件（lsof +L1）。
- 【岗位标注】运维 / AI 运维

### Q2. LVM 磁盘怎么在线扩容？完整流程是什么？

- 【考察点】LVM 概念（PV/VG/LV）与生产在线扩容流程，尤其文件系统类型决定扩容命令这条线。
- 【参考回答】先给结论：LVM 是逻辑卷管理，三层结构 PV（物理卷）→ VG（卷组）→ LV（逻辑卷），好处是可以在线扩缩容不用重新分区。扩容完整流程：先确认文件系统类型（`df -T` 看 Type 列），然后 `lvextend -L +10G /dev/vg_data/lv_app` 或 `lvextend -l +100%FREE` 扩展 LV，最后一步很关键——扩展文件系统：XFS 用 `xfs_growfs /挂载点`（只支持扩不支持缩），ext4 用 `resize2fs /dev/vg_data/lv_app`（可扩可缩）。很多新手只做了 lvextend 忘了 grow 文件系统，导致 df 看不到空间变化。生产上我的习惯：先 `vgs` 确认 VG 有剩余空间，扩完用 `df -h` 和 `lvs` 双重确认；缩容 ext4 要先 `umount` 再 `e2fsck -f` 检查再缩，非常谨慎，生产尽量只扩不缩。
- 【追问】
  - **追问1：扩的时候磁盘还是不够怎么办？** 答：加新物理磁盘后 `pvcreate /dev/sdb` → `vgextend 卷组名 /dev/sdb` → 再 `lvextend`，三步就能用上新盘。
  - **追问2：LVM 快照怎么用？** 答：`lvcreate -s -L 20G -n snap /dev/vg/lv` 创建快照，用于备份前的一致点；生产注意快照空间用完会失效，别长时间挂。
  - **追问3：LVM 扩容在虚拟机（云盘）上有什么注意？** 答：云盘先要在控制台扩容云盘，然后 `growpart` 扩展分区、`pvresize /dev/vda2` 让 PV 识别新空间，再走 lvextend + growfs 流程。
- 【岗位标注】运维

### Q3. RAID 0/1/5/6/10 各有什么特点？生产上怎么选？

- 【考察点】RAID 原理与选型判断：性能和冗余的权衡、最少盘数、坏盘处理流程。AI 运维还要懂存储 IO 场景。
- 【参考回答】先给结论：RAID0 条带化，性能最好零冗余，一块盘坏全挂，只适合临时缓存；RAID1 镜像，两块盘数据一样，坏一块不丢，空间利用率 50%；RAID5 分布式校验，最少 3 块盘，允许坏一块，空间利用率 (n-1)/n，但写性能差一点、重建时间长；RAID6 双校验，最少 4 块盘，允许坏两块；RAID10 是镜像+条带，最少 4 块盘，性能和冗余兼顾，坏盘后重建快，是数据库、核心业务的首选。生产选型我的原则：核心数据库用 RAID10（写密集、对重建时间敏感），文件服务器/备份用 RAID5/6（容量优先），现在 SSD 时代很多人直接 RAID1/10 或不用 RAID 用软件方案。坏盘处理：硬 RAID 看阵列卡日志（如 MegaRAID），软 RAID 用 `mdadm --detail /dev/md0` 查状态，`mdadm --manage /dev/md0 -r /dev/sdb -a /dev/sdd` 移除坏盘加新盘重建，期间观察 `/proc/mdstat` 的重建进度。
- 【追问】
  - **追问1：为什么说 RAID5 在大容量硬盘时代不推荐？** 答：单盘容量越大（如 12T+），重建时间越长，重建期间再坏一块的概率升高，RAID5 变 RAID6 或 RAID10 更稳。
  - **追问2：RAID 能替代备份吗？** 答：绝对不能。RAID 只防磁盘故障，防不了误删、勒索软件、逻辑错误，RAID + 异地备份才是生产标配，这个回答几乎是送分题。
  - **追问3：怎么确认服务器是硬件 RAID 还是软 RAID？** 答：`lspci | grep -i raid` 看阵列卡，`cat /proc/mdstat` 看软 RAID，`dmraid -s` 看板载方案。
- 【岗位标注】运维 / AI 运维

### Q4. CPU 使用率飙高，怎么定位到具体线程？vmstat 怎么读？

- 【考察点】性能分析思路的完整度：从整体指标（load/vmstat）到进程（top）再到线程（top -H）的逐层下钻，这是运维核心能力。
- 【参考回答】先给结论：分层定位。第一层看整体：`top` 或 `vmstat 1 5`，重点看 `r`（运行队列，持续大于核数说明 CPU 忙）、`us/sy`（用户态/内核态占比）、`wa`（IO 等待）。第二层定位进程：`top` 按 P 排序找到 CPU 最高的 PID，或用 `pidstat -u -p PID 1` 看它的 CPU 占用。第三层定位线程：`top -Hp PID` 找到占用最高的 TID，如果是 Java 应用，`printf '%x\n' TID` 转十六进制，再 `jstack PID | grep -A 30 'nid=0x...'` 看是哪个线程在跑（GC 线程还是业务线程）；C/C++ 应用用 `perf top -p PID` 看热点函数。拿到结论再决定动作：GC 频繁是内存问题、死循环是代码问题、sys 高是系统调用或锁问题。生产上先确认是不是监控告警误报、有没有突发流量，必要时先限流/扩容，再分析。
- 【追问】
  - **追问1：us 和 sy 都高说明什么？** 答：us 高是用户程序计算密集，sy 高是系统调用/内核开销大（如大量上下文切换、锁竞争），可以用 `vmstat 1` 的 `cs`（上下文切换）列佐证，cs 几十万级就是切换风暴。
  - **追问2：vmstat 的 b 列是什么意思？** 答：b 是阻塞队列，进程在等 IO 或锁；b 持续非 0 说明有进程卡在 IO 上，配合 wa 列看。
  - **追问3：怎么确认是不是核数不够？** 答：`nproc` 看核数，load average 持续大于核数、且 us 高，就是 CPU 饱和，考虑加核或降负载。
- 【岗位标注】运维 / DevOps / AI 运维

### Q5. 磁盘 IO 性能怎么排查？iostat 各字段怎么解读？

- 【考察点】IO 瓶颈定位的实操能力：%util、await 的真实含义，iowait 的误读陷阱，AI 运维场景的随机读。
- 【参考回答】先给结论：`iostat -x 1` 每 1 秒采样扩展模式，重点看三列：`%util` 磁盘繁忙度（持续大于 80% 基本饱和）、`await` 平均每次 IO 的等待时间（含排队，机械盘几毫秒、SSD 亚毫秒级，几十上百毫秒就是异常）、`r/s`/`w/s` 和 `rkB/s`/`wkB/s` 看吞吐。定位思路：先确认是 IO 瓶颈（`top` 里 wa 高、vmstat 的 b 非 0），再 `iostat -x` 看哪块盘忙，然后 `pidstat -d` 或 `iotop` 找到是哪个进程在疯狂读写。一个容易误判的点：iowait 高不代表磁盘一定坏了，可能是日志刷盘频繁（fsync）、swap 抖动（内存不足导致频繁换页写盘）、或者大量随机小 IO。AI 训练场景还要注意：数据集随机读场景看 IOPS 而不是吞吐，SSD 的随机读能力远超机械盘，所以训练数据盘基本必选 SSD/NVMe。
- 【追问】
  - **追问1：%util 100% 一定代表性能差吗？** 答：不一定，%util 是"有 IO 在排队的时间占比"，SSD 并发能力强，util 高但 await 低可能还能扛；综合看 await 和队列深度（`iostat` 的 aqu-sz）更准。
  - **追问2：怎么查看历史某个时刻的 IO 情况？** 答：sysstat 包会通过 cron 采样存历史，`sar -b 或 sar -d -f /var/log/sa/sa昨天日期` 回放，出故障时先查这个再复盘。
  - **追问3：发现是某进程疯狂写日志导致 IO 高，怎么快速处理？** 答：`lsof -p PID | grep -i log` 或 `ls -l /proc/PID/fd` 看它写的文件，确认后要么调日志级别、要么加 logrotate 切分，别直接 kill（可能是核心服务）。
- 【岗位标注】运维 / AI 运维

### Q6. free -h 怎么读？buff/cache 是什么？swap 使用高怎么办？

- 【考察点】内存模型理解：available 的正确用法、cache 可回收性、swap 与 OOM 的关系。
- 【参考回答】先给结论：`free -h` 看 total/used/free/shared/buff/cache/available，关键认知是——`used` 高不一定是问题，`buff/cache` 是内核缓存（buff 是块设备缓冲，cache 是文件页缓存），内存紧张时内核会自动回收，真正该看的是 `available`（可用内存，含可回收的 cache）。所以"内存用了 90%" 但 available 充足，不用慌；swap 是内存不足时的兜底，看到 `si`/`so`（vmstat）持续非 0 才是真的在换页抖动，说明物理内存真不够了。swap 使用高先查谁在吃：`top` 按内存排序，或 `for p in /proc/[0-9]*; do grep VmSwap $p/status; done` 找出换出最多的进程；临时释放 swap 用 `swapoff -a && swapon -a`（慎用，会卡 IO）；长期方案是调 `vm.swappiness`（默认 60，可降到 10 让系统优先用物理内存）或加内存。
- 【追问】
  - **追问1：要不要手动 echo 3 > /proc/sys/vm/drop_caches 清 cache？** 答：生产上不要主动清，内核自己会回收；drop_caches 只用于压测或测试场景，清了反而影响性能，这是经典反直觉点。
  - **追问2：应用被 OOM killer 杀了，怎么看？** 答：`dmesg | grep -i oom` 或 `journalctl -k | grep -i oom`，会显示被杀进程和当时的内存占用；预防可以给进程设 `oom_score_adj` 或 `ulimit -v`，核心服务要排查内存泄漏。
  - **追问3：swap 应该设多大？** 答：按 Red Hat 建议，内存 2G 以下设 2 倍，2-8G 设等于内存，8-64G 设 4-8G，大于 64G 设 8G 左右；具体看业务，数据库一般建议关 swap 或设很小。
- 【岗位标注】运维 / DevOps

### Q7. tcpdump 怎么抓包？什么场景会用到？

- 【考察点】网络排障的深度工具：抓包语法、常见场景（端口不通、连接重置、重传）。能说出 tcpdump 的运维基本就是实战过的。
- 【参考回答】先给结论：tcpdump 是命令行抓包工具，最常用语法：`tcpdump -i eth0 -nn port 80`（-i 指定网卡、-nn 不做域名/端口反解、port 过滤）、抓完写文件 `-w /tmp/x.pcap`、读文件 `-r`、限制包数 `-c 100`、按主机 `host 10.0.0.1`。我的使用场景：第一，端口连不上但服务在监听——抓包看 SYN 有没有回复，被防火墙 drop 是收不到回包的；第二，连接慢——看有没有大量重传（retransmission），网络丢包；第三，应用诡异报错——比如连接被对端 RST，抓包能看出是谁先断的。抓包有性能开销，生产高峰要慎用、加过滤条件、抓短时间。分析复杂场景我会用 `-w` 存下来丢 Wireshark 看，它的图形化分析（Follow TCP Stream、重传统计）比命令行高效太多。
- 【追问】
  - **追问1：怎么只抓某个进程的流量？** 答：先 `ss -lntp` 或 `lsof -i` 找到进程连接的端口和 IP，再用 port/host 过滤，tcpdump 本身不能按进程过滤。
  - **追问2：抓包能看到密码吗？** 答：明文协议（HTTP、telnet、未加密的 MySQL 老协议）能，所以生产要强制加密链路；另外抓包文件权限要收好，别泄露敏感数据。
  - **追问3：ping 不通，TCP 却通，可能吗？** 答：可能，很多云平台/防火墙默认禁 ICMP，但放行 TCP；所以判断连通性不能只靠 ping，`curl`/`nc` 验证业务端口更实际。
- 【岗位标注】运维 / DevOps

### Q8. 怎么自己写一个 systemd 服务（unit 文件）？需要注意什么？

- 【考察点】DevOps 服务治理的硬技能：unit 三段结构、Type、Restart 策略、资源限制。RHCE 新版考试也考这个。
- 【参考回答】先给结论：unit 文件放 `/etc/systemd/system/xxx.service`，三段式：`[Unit]` 描述和依赖（Description、After、Wants）、`[Service]` 启动方式和行为、`[Install]` 注册开机自启（WantedBy=multi-user.target）。一个我常用的模板：`Type=simple`（ExecStart 直接前台运行）、`ExecStart=/opt/app/start.sh`、`Restart=on-failure`（进程异常退出自动拉起）、`RestartSec=3`、`User=app`（降权运行，别用 root）、`WorkingDirectory=/opt/app`、`EnvironmentFile=/etc/app.conf`、`LimitNOFILE=65535`（进程文件句柄上限）。写好后 `systemctl daemon-reload` 再 `systemctl enable --now xxx`。三个易错点：Type 选错（daemon 型程序要 `Type=forking` + `PIDFile`，选 simple 会一直报启动失败）；脚本权限不够 x；ExecStart 里用相对路径。
- 【追问】
  - **追问1：Restart=always 和 on-failure 有什么区别？** 答：always 是任何退出都重启（包括正常退出，适合常驻服务），on-failure 是只有异常退出才重启（适合跑完就退的定时型服务）；选错会导致服务反复重启或该重启不重启。
  - **追问2：服务启动超时怎么办？** 答：`TimeoutStartSec` 调大，或确认 Type 是否正确——很多"超时失败"其实是 Type=forking 的进程没写 PIDFile，systemd 等不到主进程。
  - **追问3：改完 unit 文件不生效是怎么回事？** 答：没有 `daemon-reload`，systemd 缓存了旧配置；改任何 unit 后都要 reload 再 restart。
- 【岗位标注】DevOps / 运维

### Q9. 日志轮转 logrotate 怎么配置？程序不配合怎么办？

- 【考察点】日志治理基本功：logrotate 配置项、copytruncate 原理、测试验证方法。日志把磁盘写满是生产第一常见事故，这个必须会。
- 【参考回答】先给结论：logrotate 是日志轮转工具，主配置 `/etc/logrotate.conf`，业务配置放 `/etc/logrotate.d/` 下单独文件。经典配置：`/var/log/nginx/*.log { daily rotate 30 compress missingok notifempty dateext postrotate [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid) endscript }`——daily 每天轮转、rotate 30 保留 30 份、compress 压缩旧日志、dateext 用日期命名、postrotate 里让 nginx 重开日志文件。关键认知：大多数服务（nginx、tomcat）打开日志文件后会一直持有句柄，直接 rename 的话新日志还写进旧文件里，所以要么服务支持重开（postrotate 发信号），要么用 `copytruncate`（先复制再清空，适合不支持重开的服务，代价是可能丢几行日志）。验证配置：`logrotate -d /etc/logrotate.d/xxx` 调试模式（不实际执行）、`logrotate -f` 强制执行一次，执行记录在 `/var/log/logrotate`（或 cron 日志）。
- 【追问】
  - **追问1：日志文件被删了但进程还在写，df 怎么都不降？** 答：就是前面说的句柄问题，`lsof | grep deleted` 找进程重启或发信号重开；这正是 logrotate 的 postrotate 存在的意义。
  - **追问2：按大小轮转怎么写？** 答：`size 100M` 替代 daily，日志达到 100M 就轮转，适合日志量大且不规律的场景。
  - **追问3：logrotate 是谁在触发？** 答：系统 cron 每天执行 `/etc/cron.daily/logrotate`（老系统），新版 RHEL 用 systemd timer（`systemctl list-timers | grep logrotate`）；所以要确认系统 cron/timer 正常，否则配置了也不转。
- 【岗位标注】运维 / DevOps

### Q10. SSH 密钥认证和安全加固怎么做？

- 【考察点】SSH 运维必备：密钥生成分发、权限要求、sshd 加固项。这也是被黑的第一入口，面试必问。
- 【参考回答】先给结论：密钥认证三步——`ssh-keygen -t ed25519` 生成密钥（ed25519 比 rsa 更安全更短，老环境用 `-t rsa -b 4096`），`ssh-copy-id user@ip` 把公钥分发到目标机（自动写 authorized_keys 并设好权限），然后密钥登录。关键细节：`~/.ssh` 目录权限必须 700、`authorized_keys` 必须 600，权限太松 sshd 直接拒绝用密钥登录（这是最常见的报错原因）。加固项按优先级：`PermitRootLogin no`（禁止 root 直登，用普通用户 + sudo）、`PasswordAuthentication no`（关密码登录防爆破，但一定先确认密钥能用再关，否则锁死自己）、`Port` 改非默认、`AllowUsers 指定白名单`；改完 `sshd -t` 检查语法再 `systemctl reload sshd`。防爆破可以上 fail2ban 或云安全组只放行办公网 IP。跳板机/内网穿透用 `ProxyJump`：`ssh -J jump@堡垒机 app@目标机`，不用每台都配 key。
- 【追问】
  - **追问1：改了 sshd 配置后怎么避免把自己锁在门外？** 答：`sshd -t` 先验证语法，然后开一个新终端测试能登录再 `reload`；或者 reload 前保持当前会话不关，这是运维的基本素养。
  - **追问2：批量给 100 台机器配密钥怎么做？** 答：Ansible 的 `authorized_key` 模块或 `ssh-copy-id` + 循环脚本，生产上用 Ansible 管理是标准做法，正好呼应简历上的 Ansible 技能。
  - **追问3：known_hosts 是什么？** 答：记录你连过的主机指纹，防止中间人攻击；换过密钥的主机再连会报 host key 冲突，要 `ssh-keygen -R 主机名` 清掉旧记录。
- 【岗位标注】运维 / DevOps

### Q11. "Too many open files"（文件句柄耗尽）是怎么回事？怎么处理？

- 【考察点】资源限制机制：ulimit 软硬限制、系统级 file-max、进程级排查。高并发服务必踩，面试官爱考。
- 【参考回答】先给结论：文件句柄是进程打开的文件的编号，Linux 默认每个进程限制通常 1024，高并发服务（nginx、MySQL、Java 应用）很容易耗尽，报错就是 "Too many open files"。排查顺序：`ulimit -n` 看当前 shell 限制，`cat /proc/PID/limits` 看某个进程的实际限制（注意硬限制，普通用户不能超过 hard 值），`lsof -p PID | wc -l` 或 `ls /proc/PID/fd | wc -l` 看进程实际打开了多少句柄，`ss -s` 看是不是连接数暴涨。处理分三层：临时调大 `ulimit -n 65535`（只对当前 shell 和其子进程有效）；永久调大改 `/etc/security/limits.conf`（`* soft nofile 65535`、`* hard nofile 65535`，适用于非 systemd 场景）；systemd 管理的服务要在 unit 里写 `LimitNOFILE=65535`（limits.conf 对 systemd 服务不生效，这是最容易踩的坑）；系统级上限看 `cat /proc/sys/fs/file-max` 和 `fs.file-nr`。
- 【追问】
  - **追问1：改成 65535 还够吗？上限是多少？** 答：看业务，高并发网关类可以 100 万级别；系统级 `fs.file-max` 可以调大，但句柄多意味着内存开销大（每个句柄约 1KB 内核内存），要评估。
  - **追问2：怎么定位是哪个进程把句柄耗尽的？** 答：`for p in /proc/[0-9]*; do echo "$p $(ls $p/fd 2>/dev/null | wc -l)"; done | sort -k2 -rn | head`，或 `lsof | awk '{print $1}' | sort | uniq -c | sort -rn | head`。
  - **追问3：连接数正常但句柄还是高，可能是什么？** 答：程序没关文件（泄漏）、日志文件句柄没释放、或者打开的文件没 close；用 `lsof -p PID | grep -v TCP` 看非网络类句柄。
- 【岗位标注】运维 / AI 运维

### Q12. ACL 权限怎么用？什么场景必须用 ACL？

- 【考察点】标准 rwx 权限之外的扩展能力：setfacl/getfacl、mask 含义、默认 ACL。答得出 ACL 说明权限这块是真学透了。
- 【参考回答】先给结论：ACL（访问控制列表）能对单个用户/单个组单独授权，突破"属主/属组/其他"三组权限的限制。场景很明确：一个目录要同时给多个组不同权限，比如 `/data/shared` 给 dev 组读写、给 ops 组只读、给张三个人读写——标准权限做不到，ACL 可以。命令：`setfacl -m u:zhangsan:rwx /data/shared` 加用户权限、`setfacl -m g:ops:r-x` 加组权限、`getfacl` 查看、`setfacl -x u:zhangsan` 删除、`-R` 递归、`-d` 设置默认 ACL（目录里新建文件自动继承）。注意两点：设置了 ACL 后 `ls -l` 权限位会多一个 `+`；ACL 的 mask 会限制所有命名用户/组的最大权限，`getfacl` 里能看到 mask 行，别忽略了它。生产上我会优先用"属组 + SGID + umask"方案，只有多角色场景才上 ACL。
- 【追问】
  - **追问1：ACL 和 sudo 是一回事吗？** 答：不是。ACL 管"谁能访问文件"，sudo 管"谁能以什么身份执行命令"，是两个维度。
  - **追问2：默认 ACL 和普通 ACL 区别？** 答：普通 ACL 只作用于当前已存在的文件/目录；默认 ACL（`-d`）作用于目录里以后新建的文件，做共享目录时两个通常一起设。
  - **追问3：复制文件时 ACL 会跟着走吗？** 答：`cp -p` 保留权限但 ACL 可能丢失，用 `getfacl 源 | setfacl --set-file=- 目标` 复制 ACL；rsync 加 `-A` 参数保留。
- 【岗位标注】运维

---

## 四、生产实战·刁钻篇（10 题）

### Q1. 生产磁盘显示 100%，但 du 扫遍所有目录都找不到大文件，怎么处理？

- 【考察点】磁盘满的真实排障能力：会不会按顺序用 df/du/lsof，知不知道"删除未释放"和 inode 两种隐蔽情况。这是最经典的生产事故，答得好直接加分。
- 【参考回答】先给结论：这种情况 90% 是"文件被删除但被进程占用"或"inode 耗尽"，按这个顺序查：第一步 `df -h` 和 `df -i` 一起看——df -i 满就是 inode 耗尽（大量小文件），df -h 满但 du 对不上就走第二步；第二步 `lsof +L1` 列出所有"被删除但仍被打开"的文件（+L1 表示链接数为 0），或者 `lsof | grep -i deleted`，看到后 `ls -l /proc/PID/fd` 确认文件大小，处理办法是重启该进程让它释放，如果进程不能重启，可以用 `> /proc/PID/fd/文件描述符号` 直接清空内容（写入空但不删除 inode，进程还能继续写，空间立即释放）；第三步如果都不是，查挂载点：`mount` 看有没有子目录被单独挂载"掩盖"了（比如 /data 下还挂了个 /data/app，du /data 看不到 /data/app 的内容），以及查 `/var/log` 下有没有没轮转的日志（`du -sh /var/log/*`）。最后别忘排查完了要落监控：磁盘使用率、inode 使用率都进告警。
- 【追问】
  - **追问1：为什么 > /proc/PID/fd/N 能释放空间？** 答：文件 inode 还在（被进程持有），只是内容被 truncate 成 0，数据块立即释放；比杀进程影响小，适合数据库这类不能随便重启的服务。
  - **追问2：清完之后 df 还是不降怎么办？** 答：还有别的进程占着别的 deleted 文件，循环 lsof +L1 全查一遍；或者有文件在没挂载的底层设备上（比如容器 overlay 层）。
  - **追问3：怎么预防再发生？** 答：日志 logrotate 必须配好（postrotate 重开句柄）、监控加 inode、大文件目录做定期清理脚本、部署上线前评估磁盘容量。
- 【岗位标注】运维 / AI 运维

### Q2. 线上服务 CPU 突然 100%，完整处理流程是什么？

- 【考察点】生产应急的真实流程：不是"背命令"，而是"先止血、再定位、最后根治"，还要会 Java 线程栈分析这类细节。
- 【参考回答】先给结论：我的流程是"止血—定位—根治"三步。第一步止血：先看是不是监控误报或突发流量，`uptime` 看 load，`top -b -n1 | head -20` 看谁在吃 CPU；如果是某实例异常，先把它从负载均衡摘掉（nginx upstream 临时注释/云 LB 下线），保住整体可用性，这是生产第一原则。第二步定位：`top` 找 PID → `top -Hp PID` 找线程 TID → `printf '%x\n' TID` 转十六进制 → Java 用 `jstack PID | grep -A30 'nid=0x十六进制'` 看线程栈，C++ 用 `perf top -p PID` 看热点函数；同时看 GC 日志（`-verbose:gc`）确认是不是 GC 风暴。第三步根治：死循环找开发修代码、GC 风暴调堆参数或加内存、锁竞争看代码逻辑；修完放回 LB，观察 10 分钟确认 load 回落。注意：定位清楚之前别急着 kill -9，可能杀了正在处理请求的进程导致数据不一致；也不要在生产高峰直接 perf，有开销。
- 【追问】
  - **追问1：GC 风暴怎么判断？** 答：`jstat -gcutil PID 1000` 看 Full GC 次数和耗时，FGC 频繁且 FGCT 一直涨就是；或看 CPU 里 GC 线程占用（jstack 里 gc 线程名字带 GC）。
  - **追问2：如果是进程内死循环，除了等开发还能做什么？** 答：重启只能救一时，要拿线程栈快照（连续 jstack 3-5 次）给开发留证据；有些场景可以先用 `jcmd` 或 Arthas 热诊断。
  - **追问3：多核机器怎么确认是单核被打满还是整体？** 答：`mpstat -P ALL 1` 看每核利用率，单核 100% 其他低说明是单线程热点（如单线程代码、锁串行化），整体都高才是并行计算密集。
- 【岗位标注】运维 / DevOps

### Q3. 端口连不上，怎么一步步排查？大量 TIME_WAIT 是什么问题？

- 【考察点】网络排障 SOP 和 TCP 状态机理解：从服务到防火墙到网络逐层排除，TIME_WAIT 的成因与优化。
- 【参考回答】先给结论：排查按"服务—监听—防火墙—网络"四层走。第一步服务：`systemctl status 服务名` 或 `ps -ef | grep 服务名` 确认进程活着。第二步监听：`ss -lntp | grep 端口` 确认在监听（`-l` 只显示 LISTEN 状态，`-t` TCP，`-p` 显示 PID，没有 -p 权限就 `sudo`）；如果监听在 127.0.0.1 而不是 0.0.0.0，外网肯定连不上——这是常见坑。第三步防火墙：`firewall-cmd --list-all` 或 `iptables -L -n` 看端口有没有放行，`nft list ruleset`（新系统）。第四步网络：本机 `curl`/`nc -zv` 测，外部 `telnet ip 端口`、`traceroute`/`mtr` 看链路，必要时 tcpdump 看 SYN 有没有回应。关于 TIME_WAIT：它出现在主动关闭方，是 TCP 保证可靠性的正常状态（2MSL 约 60 秒），大量堆积常见于高并发短连接（每次请求新建连接）；优化方向是客户端/应用层启用连接复用（keep-alive、连接池），系统参数 `net.ipv4.tcp_fin_timeout` 调小、`tcp_tw_reuse=1`（只对客户端有效，服务端别乱开，NAT 环境有坑），而不是看到 TIME_WAIT 就慌。
- 【追问】
  - **追问1：ss 和 netstat 有什么区别？** 答：ss 更快更准（直接读内核 socket 表），netstat 已废弃但老脚本还在用；新环境一律用 ss。
  - **追问2：怎么数当前 TCP 各状态的数量？** 答：`ss -tan | awk '{print $1}' | sort | uniq -c | sort -rn`，看 ESTABLISHED、TIME_WAIT、SYN_SENT 的分布，SYN_SENT 多说明对端不通或丢包。
  - **追问3：服务监听正常、防火墙也放行了，外网还是连不上？** 答：查云安全组/网络 ACL（很多公司是云上策略管的）、查 NAT/负载均衡转发规则，`tcpdump -i eth0 port 端口` 看 SYN 有没有到服务器。
- 【岗位标注】运维 / 技术支持

### Q4. 进程卡在 D 状态（不可中断睡眠）或成了僵尸，kill -9 都杀不掉，怎么办？

- 【考察点】对进程状态的深度理解：D 状态本质是内核等待 IO，为什么杀不掉，处理手段是什么。这是区分"背题"和"懂内核行为"的题。
- 【参考回答】先给结论：分两种。僵尸（Z）前面说过，它已经死了，杀它没意义，处理父进程即可。D 状态是进程在内核里等 IO（不可中断睡眠），典型的比如 NFS 挂起、磁盘坏道导致 IO 卡死、或者存储网络断连，此时进程在内核态睡眠，任何信号都杀不掉——`kill -9` 无效是正常现象，别反复试。处理思路：第一，先定位在等什么 IO：`ps -o pid,stat,wchan -p PID` 看 wchan（内核等待点），`cat /proc/PID/stack` 看内核栈，`dmesg` 看有没有 IO 报错（如 NFS server not responding、SCSI 错误）；第二，如果是 NFS，`umount -f` 或重启 NFS 服务让 IO 返回；如果是磁盘故障，等 IO 超时恢复或换盘；第三，实在不行，进程恢复不了就只能重启机器（重启前确认别的服务状态，别把整台机器带崩）。生产预防：存储/NFS 挂载要有超时和冗余，监控里对 D 状态进程数告警（`ps -A -o stat | grep -c '^D'`）。
- 【追问】
  - **追问1：D 状态进程多了对系统有什么影响？** 答：占着进程表项和内存不释放，阻塞队列变长（vmstat b 列），load average 会被拉高——这正好解释了"load 高但 CPU 不忙"的怪象。
  - **追问2：怎么让 D 状态进程恢复？** 答：让它的 IO 返回：修存储、恢复 NFS、拔掉坏盘让 SCSI 层超时；多数情况等内核 IO 超时（如 NFS 默认 600 秒）会自动恢复，极端情况只能重启。
  - **追问3：重启机器前要注意什么？** 答：`sync` 先刷盘（虽然 D 状态可能刷不动），确认机器上没有必须人工保存的状态，重启后重点检查挂载和依赖服务。
- 【岗位标注】运维 / AI 运维

### Q5. 高并发服务报 "too many open files"，排查和解决全流程？

- 【考察点】文件句柄问题的完整链路：系统层、进程层、systemd 层三个维度都要会，这题和进阶篇 Q11 呼应，刁钻在"全流程和坑"。
- 【参考回答】先给结论：按"症状确认→定位持有者→调整限制→验证持久化"四步。第一步确认：`dmesg | tail` 看内核有没有报 `fs.file-max` 满，`cat /proc/sys/fs/file-nr` 看系统已用句柄（第一列）/上限（第三列），接近上限就是系统级问题；没到就是单个进程的问题。第二步定位：`ls /proc/PID/fd | wc -l` 数每个进程的句柄数，脚本循环所有 PID 排序找最高的；再 `lsof -p PID | head` 看都是什么文件——是网络连接（`ss -s` 连接数暴涨）还是普通文件（代码泄漏没 close）。第三步调整：单进程临时 `ulimit -n 65535`；永久按服务类型分——systemd 服务改 unit 的 `LimitNOFILE`（`systemctl cat 服务名` 先看现在多少），非 systemd 改 `/etc/security/limits.conf`；系统级 `fs.file-max` 调大并写 `/etc/sysctl.conf`。第四步验证：`systemctl daemon-reload && systemctl restart 服务名` 后 `cat /proc/PID/limits` 确认生效，别重启完发现没生效（systemd 服务改 limits.conf 不生效是最常见的坑）。
- 【追问】
  - **追问1：硬限制和软限制有什么区别？** 答：软限制是当前生效值（进程可以自己调高，最多到硬限制），硬限制是上限；普通用户不能把硬限制调更高，root 可以；配置时 nofile 和 nproc（进程数）都要注意。
  - **追问2：句柄数设多大合适？** 答：按业务压测定，常规服务 65535 起步，高并发网关类可以几百万，但每个句柄约 1KB 内核内存，设太大浪费；配合监控看实际使用率再调。
  - **追问3：连接数没涨但句柄涨，是什么？** 答：程序没 close 文件（泄漏）、或打开了大量小文件/目录句柄，`lsof -p PID | grep -v -E 'TCP|UDP'` 过滤网络连接再看。
- 【岗位标注】运维 / AI 运维

### Q6. 应用进程被 OOM killer 杀了，怎么排查和预防？

- 【考察点】内存管理实战：OOM 判定逻辑、dmesg 取证、oom_score_adj 调优、根因是内存泄漏还是配置不当。
- 【参考回答】先给结论：OOM killer 是内核内存耗尽时的"最后手段"，会按 oom_score 挑一个进程杀（通常是占用最多或 score 最高的）。排查取证：`dmesg | grep -i oom` 或 `journalctl -k | grep -i oom`，能看到类似 "Out of memory: Kill process 12345 (java) score 850 or sacrifice child" 的信息，重点记下当时的进程和内存占用；配合 `journalctl --since "5 min ago"` 看被杀前后系统内存快照（cgroup 场景看 `/sys/fs/cgroup/.../memory.events` 的 oom 计数）。根因分析：是内存泄漏（进程 RSS 只涨不降，`top` 连续观察）、配置超卖（JVM 堆 + 非堆 + 线程栈超过物理内存）、还是 cache 挤占（一般不会，cache 可回收，真到 OOM 就是物理内存真不够）。预防：核心进程设 `oom_score_adj` 提高存活优先级（比如 `echo -500 > /proc/PID/oom_score_adj`，或 systemd unit 写 `OOMScoreAdjust=-500`）、数据库/Redis 这种关键服务设保护；根治要调 JVM 堆参数（`-Xmx` 别超过物理内存的 60-70%，留足系统余量）、或加内存。
- 【追问】
  - **追问1：为什么机器内存还有 free，进程却被杀了？** 答：cgroup 限制（容器场景最常见）：进程 cgroup 的 memory.limit 到了就会被组内 OOM，而宿主机还有内存；看 `/sys/fs/cgroup` 下对应组的 memory.max/memory.current。
  - **追问2：怎么防止 OOM 杀到数据库？** 答：`mysqld` 的 systemd unit 里设 `OOMScoreAdjust=-800`（数字越小越不容易被杀），同时给数据库单独预留内存、监控内存水位提前告警。
  - **追问3：OOM 之后怎么快速恢复服务？** 答：监控发现进程消失要自动拉起（systemd Restart=on-failure、supervisor、容器 orchestrator 重启策略），生产核心服务必须有自动重启+告警，人工发现再登录已经慢了。
- 【岗位标注】运维 / AI 运维

### Q7. load average 很高，但 CPU 使用率很低，怎么回事？

- 【考察点】反直觉性能题的经典：load 的构成不只是 CPU，D 状态进程会直接拉高 load。这题能区分"背过 top"和"理解 load"。
- 【参考回答】先给结论：load average 统计的是"运行队列 + 不可中断睡眠（D 状态）"的进程数，所以 load 高不等于 CPU 忙。CPU 低但 load 高，按概率排查三种：第一种是 IO 阻塞——大量进程卡在 D 状态等磁盘/NFS，`top` 里看 wa 列、`vmstat 1` 看 b 列、`ps -A -o stat | grep -c '^D'` 数 D 状态数量，配合 `iostat -x` 确认磁盘；第二种是锁等待——进程在内核态等锁（文件锁、`futex`），CPU 不忙但任务排队；第三种是内存换页风暴——swap 抖动，`vmstat` 的 si/so 持续非 0，进程等着换入换出。处理：先 `top` 按 S（状态）看有没有一片 D，`pidstat -d` 看谁在等 IO；如果是存储/NFS 问题先恢复存储，然后 load 自然回落；别一看 load 高就加机器，先分清是 CPU 型还是 IO 型。
- 【追问】
  - **追问1：怎么一句话给 load average 下定义？** 答：过去 1/5/15 分钟内，处于可运行和不可中断状态的进程平均数；很多人只知道"高=忙"，不知道 D 状态也计入。
  - **追问2：IO 型 load 高和 CPU 型 load 高怎么区分？** 答：CPU 型是 us/sy 高、wa 低；IO 型是 wa 高、us/sy 低、D 状态多；`uptime` + `top` + `vmstat` 三件套 10 秒就能分清。
  - **追问3：D 状态进程数怎么快速统计？** 答：`ps -A -o stat | grep -c '^D'`，或 `top` 里按状态过滤；做监控脚本时把这个数加进告警。
- 【岗位标注】运维 / DevOps

### Q8. 简历写了 Ansible：说说幂等性是什么？playbook 怎么写？批量管理 100 台机器怎么做？

- 【考察点】简历技能深挖（RHCE 新版 EX294 考的就是 Ansible）：是否真的用过，还是只看了教程。幂等性、模块、playbook 结构、批量策略四个点连环问。
- 【参考回答】先给结论：幂等性是指"同样的任务执行多次，结果一致、不产生副作用"，比如 `copy` 模块传同一个文件，目标文件内容一致就不重新写；而 `shell` 模块天然不幂等（每次执行都跑一遍命令），所以能用专用模块就别用 shell。playbook 是 YAML 文件，核心结构：`hosts`（目标主机组）、`become: yes`（提权）、`tasks`（任务列表）、`handlers`（变更后触发，比如改完配置 notify 重启服务）、`vars`（变量）、`templates`（Jinja2 模板渲染配置）。批量 100 台的几个要点：inventory 里按业务分组；`forks` 控制并发（默认 5，批量可以调高）；重要服务用 `serial: 10` 分批滚动更新（一次只动 10 台，出事能停）；任务里加 `ignore_errors` 或 `failed_when` 处理可容忍的失败；敏感变量用 `ansible-vault encrypt` 加密；密码用 `--ask-pass` 或 ssh key 免密（生产用 key + `--ask-become-pass`）。我常用的模块：`yum`（装包）、`copy`/`template`（分发配置）、`service`/`systemd`（启停）、`lineinfile`（改配置里的一行）、`user`（建用户）、`cron`（布定时任务）、`script`（跑本地脚本）。
- 【追问】
  - **追问1：改完配置怎么触发服务重启？** 答：任务里 `notify: restart nginx`，handlers 里定义 `- name: restart nginx` + `systemd: name=nginx state=restarted`；handler 只在任务状态 changed 时触发，这就是幂等设计。
  - **追问2：滚动更新时怎么保证不出事故？** 答：`serial` 分批 + 每批跑完做健康检查（`uri` 模块 curl 健康接口，`failed_when` 判断返回码），挂了就 `any_errors_fatal: yes` 停止继续。
  - **追问3：Ansible 的执行日志和报错怎么看？** 答：`ansible-playbook -v` 加详细输出，`-C` 干跑模式先模拟一遍，结果存 `/var/log/ansible` 或控制机日志；批量失败先看失败的主机 IP 和 task 名称。
- 【岗位标注】DevOps / 运维

### Q9. 简历写了 RHCE 证书：你当时考了什么内容？是什么时候考的？

- 【考察点】证书含金量验证：RHCE 新版（EX294）和旧版（EX300）内容完全不同，考过的人不可能不知道；同时考察证书时效。这题答得干净，简历可信度直接拉满。
- 【参考回答】先给结论：我考的是 RHCSA（EX200）+ RHCE（EX294）双认证，RHCSA 考系统管理基础——用户权限、文件系统、LVM、systemd、防火墙、cron、SELinux 这些；RHCE（新版）考的是 **Ansible 自动化运维**——写 playbook 批量部署、配置管理、服务编排、变量与模板、任务控制（handlers、条件、循环），考试形式是纯实操机考，给一台真机按题目完成配置，没有选择题。证书是【年份】年考的（这里按真实情况说），拿到之后这些年一直在一线做 Linux 运维，Ansible 和系统管理的技能在生产里每天都在用。如果被问到证书时效，我了解红帽从 2019 年 10 月起新认证有效期是 3 年，所以我也会跟进红帽官方课程和社区版本（CentOS Stream、Rocky、Ansible）保持技能不过时——证书本身代表我系统学过并通过了考核，技能是否过关还是看现场实操。
- 【追问】
  - **追问1：RHCSA 和 RHCE 是两张证书还是一张？** 答：两张，RHCSA 是前提（先过 EX200），RHCE 是 EX294；两个都过了才是完整的双认证，简历写 RHCE 通常默认也过了 RHCSA。
  - **追问2：你考试环境用的什么系统？** 答：红帽官方认证机考环境是 RHEL（当时考的版本按实际说），和 CentOS 完全同源，命令和 systemd 体系一致，所以生产 CentOS/Rocky 上的经验是直接通用的。
  - **追问3：SELinux 在 RHCE 里考吗？** 答：考，RHCSA 里要求能处理 SELinux 的常见问题（`getenforce`、`semanage fcontext`、`restorecon`、`chcon`），这个点很多"背题党"答不上来，因为我真考过所以记得。
- 【岗位标注】通用 / 运维 / DevOps

### Q10. 简历写"精通 Shell"：现场写个脚本统计 access.log 里访问量 TOP10 的 IP；另外 rm -rf 误删过文件吗？怎么防？

- 【考察点】简历技能实测：能不能现场写对管道组合；生产安全意识（误删是运维头号事故，答"没删过"不可信，答"怎么防"才加分）。
- 【参考回答】先给结论：统计 TOP10 IP 用管道一行搞定：`awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10`——awk 取第一列 IP，sort 排序让相同 IP 相邻，uniq -c 计数，sort -rn 按次数倒序，head 取前 10。如果想顺手看占比，可以再套 `awk '{printf "%s %.2f%%\n", $2, $1/NR*100}'` 这种。关于误删：生产环境我从不裸敲 `rm -rf`，我的防误删三板斧：第一，上线/操作前先 `ls` 确认路径和目录内容（尤其是变量拼接路径，`rm -rf $DIR/` 里变量为空就是灾难），绝不在不确认的情况下用通配符；第二，关键数据必须有备份和异地副本（rsync/备份系统），删除前先确认有备份；第三，高危操作套保护壳——把 `rm` 换成别名或回收站脚本（`mv` 到 `/tmp/trash` + 定期清理），或者干脆用 `mv` 到临时目录观察几天再删。还有一招很实用：删大目录前 `du -sh` 确认大小和路径，删完 `df -h` 确认空间真的释放了（顺便发现 deleted 占用的问题）。
- 【追问】
  - **追问1：如果真 rm -rf 删了重要目录，能恢复吗？** 答：实话实说，没备份基本恢复不了——ext4 上有 debugfs/第三方工具理论可恢复，但生产环境成功率很低且耗时；所以正确姿势是"防"而不是"恢复"，我删任何东西之前都确认备份，这也是为什么我的脚本里都带备份步骤。
  - **追问2：变量为空的 rm -rf 怎么防？** 答：`set -u`（脚本里变量未定义直接报错退出）+ 删前判断 `[ -n "$DIR" ] && [ -d "$DIR" ]` 再执行；用 `rm -rf -- "$DIR"` 防止路径以 - 开头被当成参数。
  - **追问3：除了 TOP IP，还写过什么常用脚本？** 答：磁盘使用率巡检告警（`df -h | awk` 过滤超过 80% 的分区 + curl 推企业微信/钉钉 webhook）、日志按天压缩清理、批量检查 100 台机器服务状态的 Ansible ad-hoc + 脚本配合、MySQL 定时备份（mysqldump + gzip + rsync 异地）。
- 【岗位标注】通用 / 运维 / DevOps

---
