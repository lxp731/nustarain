---
title: Shell 与 Python 面试问答（34 题）
date: 2026-08-27 09:30:00
categories: 技术
tags:
  - python
  - Linux
  - 面试

---

本文整理了Shell 与 Python 面试问答（34 题）相关的 34 个高频面试问题，从基础到进阶再到生产实战层层递进，覆盖python、Linux、面试等核心考点，每题附参考回答与追问，适合面试前系统复习。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

## 一、岗位高频速查

| 岗位 | 必考问题（高频 3-5 问） | 一句话要点 |
|---|---|---|
| 运维工程师 | 1. `set -euo pipefail` 每项什么含义？2. 排查磁盘满 / 负载高的命令链？3. 写一个每天 2 点执行的日志清理脚本（含 cron）？4. `nohup` / `&` / `jobs` 区别？后台任务怎么管？5. 脚本如何保证只跑一个实例？ | 重点在"能用脚本把巡检 / 清理 / 备份自动化并扛得住故障"，每题都要能报出具体命令和退出码语义 |
| 技术支持工程师 | 1. 批量改 100 台机器配置你用什么方法？2. 脚本报错怎么定位（bash -x / 日志）？3. 同一个脚本重复执行会不会出问题（幂等）？4. Windows 与 Linux 脚本有什么差异？5. 你的拷贝工具比资源管理器快是怎么做到的？ | 侧重"解决问题 + 可复现"，讲清楚工具的输入、输出、异常处理、失败重跑，别背概念 |
| AI 运维工程师 | 1. 用 requests 调大模型 API 如何做超时与重试？2. 多线程 / 多进程处理日志、批量请求怎么选？3. 异常处理与日志规范？4. Python 调用外部命令 subprocess？5. 大文件 / 大日志逐行处理不爆内存？ | 几乎全 Python：超时、重试、限流、并发、日志、异常兜底是必背组合拳 |
| DevOps 工程师 | 1. CI 流水线脚本如何保证失败即停（exit code / pipefail）？2. 容器里调试脚本与宿主机有什么差异？3. Shell 与 Python 什么时候用哪个？4. 脚本如何做到幂等与可重入？5. 文本三剑客批量改配置？ | 与运维高度重叠，另加"交付物是流水线 / 镜像里的脚本"，强调可维护性、参数化、退出码约定 |

> 补充：SRE、数据库运维等衍生岗位与"运维工程师"栏高度重叠；差异题（如 k8s 里调试、编排器集成）低频，了解即可，不必专门准备。

## 二、基础篇（12 题）

### Q1. Shell 中单引号、双引号、反引号和 $() 有什么区别？

- 【考察点】变量替换、命令替换、分词（word splitting）三个基础概念是否真懂，还是只会背结论
- 【参考回答】先给结论：单引号里面是什么就是什么，不做任何替换；双引号里做变量替换和命令替换，但不做分词和通配符展开；反引号和 `$()` 都是命令替换——执行里面的命令并把输出当字符串，`$()` 可以嵌套、反斜杠处理更友好，所以统一推荐 `$()`。举例：`name=world; echo 'hello $name'` 输出字面量 `hello $name`，`echo "hello $name"` 输出 `hello world`，`echo "today: $(date +%F)"` 输出日期。我踩过的坑：`echo $file` 不带引号会被分词，文件名带空格直接裂开，所以变量引用一律加双引号。
- 【追问】
  - 追问 1：`echo $(ls)` 和 `echo "$(ls)"` 输出有什么区别？—— 不带引号时命令替换结果会被再次分词：多行被拍平成一行、连续空格被折叠；带引号保留换行和空格。处理文件列表时必须用 `"$(...)"` 或改用数组。
  - 追问 2：`$()` 里引号怎么嵌套？—— 可以随意嵌套单双引号，如 `echo "$(echo 'a"b')"`；反引号则要转义 `\`` 和 `\$`，容易写错，这也是我不用反引号的原因。
- 【岗位标注】通用

### Q2. $?、$#、$@、$*、$$、$!、$0 分别是什么？

- 【考察点】特殊变量是排查脚本问题的基础，答不全基本说明没怎么写过错综的脚本
- 【参考回答】$? 是上一条命令的退出码，0 成功非 0 失败，这是脚本判断成败的基石；$# 是位置参数个数；$@ 是所有参数、每个参数独立成词（转发参数时用 `"$@"`），$* 是把所有参数拼成一个字符串（一般 `"$*"` 用于拼接）；$$ 是当前 Shell 的 PID，常用于生成临时文件名 `tmp_$$`；$! 是最近一个后台任务的 PID，配 `wait $!` 用；$0 是脚本名，$1~$9 是位置参数，超过 9 个用 `${10}`。生产里最常用的是用 $? 判断命令成败，决定日志级别和退出码。
- 【追问】
  - 追问 1：`"$@"` 和 `"$*"` 能举个实际例子吗？—— `f(){ for x in "$@"; do echo "[$x]"; done; }`，传 `f a "b c"`：`"$@"` 输出 `[a]`、`[b c]` 两项；`"$*"` 只输出 `[a b c]` 一项。把参数原样转交给子命令时必须用 `"$@"`。
  - 追问 2：怎么判断一个命令"失败"而不只是退出码非 0？—— 先看退出码语义：很多命令返回 1 是正常业务结果（如 grep 没匹配到、diff 有差异）；再看 stderr 有没有输出；最后配合 `set -o pipefail` 才能拿到管道中真正的失败。
- 【岗位标注】通用 / 运维 / DevOps

### Q3. 条件判断里 [ ] 和 [[ ]] 和 test 有什么区别？文件判断和比较有哪些？

- 【考察点】脚本里的 if 用得对不对，能否避开常见语法坑
- 【参考回答】`test` 和 `[ ]` 是同一个命令，POSIX 兼容，要求变量加引号、运算符两边留空格；`[[ ]]` 是 bash 内置关键字，不做分词和通配符展开，所以 `[[ -f $file ]]` 即使 $file 为空也不会报错，还支持 `=~` 正则和 `<` `>` 字典序比较——能写 bash 的脚本我尽量用 `[[ ]]`。文件判断常用 `-f` 普通文件、`-d` 目录、`-e` 存在、`-s` 非空、`-r/-w/-x` 权限；整数比较用 `-eq -ne -gt -ge -lt -le`，字符串用 `= != -z -n`。经典坑：`[ $n -gt 5 ]` 在 n 为空时报 `unary operator expected`，`[[ $n -gt 5 ]]` 则安全。
- 【追问】
  - 追问 1：`[[ $a =~ ^[0-9]+$ ]]` 和 `[ $a =~ ... ]` 有差别吗？—— `=~` 是 `[[ ]]` 独有，写在 `[ ]` 里直接语法错误；正则表达式不用加引号。
  - 追问 2：逻辑与或怎么写？—— `[ ]` 里用 `-a / -o` 或 `&& / ||` 连接两个 test；`[[ ]]` 直接 `&& || !`，还能 `[[ (a -eq 1 && b -eq 2) || c ]]` 分组。
- 【岗位标注】通用 / 运维

### Q4. for / while / until 三种循环分别什么场景？遍历文件内容怎么最稳？

- 【考察点】循环是脚本高频动作，重点看会不会踩"文件名带空格""空行"的坑
- 【参考回答】结论：for 适合遍历已知列表、数组、通配符展开结果——`for f in *.log` 或 `for i in {1..10}`；while 适合按条件循环和逐行读文件——`while IFS= read -r line; do ...; done < file` 是逐行读的标准姿势，`IFS=` 保留首尾空格、`-r` 保留反斜杠，文件名带空格、换行都能处理；until 是 while 的取反，条件为假才循环，适合"等一个服务起来"：`until curl -sf http://localhost:8080/health; do sleep 1; done`。三个坑：`for f in $(cat list)` 会被分词，文件名带空格直接裂开；`for i in $(seq 1 10)` 不如 `for ((i=1; i<=10; i++))`；`break` / `continue` 记得用。
- 【追问】
  - 追问 1：如何安全地遍历 find 的结果？—— `find . -name '*.log' -print0 | while IFS= read -r -d '' f; do ...; done`，用 NUL 分隔，任何文件名都安全。注意管道版 while 跑在子 shell 里，循环里改的变量外面拿不到；要拿到就改用进程替换：`while ...; done < <(find ...)`。
  - 追问 2：`for i in {1..100000}` 有什么问题？—— 大括号展开会先把 10 万个词生成到内存里，用 `seq` 或 C 风格 `for ((...))` 代替。
- 【岗位标注】通用 / 运维

### Q5. Shell 函数怎么定义？变量作用域怎么回事？

- 【考察点】函数是脚本工程化的分水岭，答不出 local 基本等于没写过超过 100 行的脚本
- 【参考回答】定义是 `func() { ...; }` 或 `function func { ...; }`，调用就是写函数名。函数里的变量默认是**全局**的——在函数里 `x=1` 会污染外部，这是新手最常踩的坑，所以函数内部变量一律 `local x=1`。函数"返回值"有两套：`return N` 设置退出码（0-255）；echo 输出传给调用者，拿的时候用 `result=$(func)`。注意区分"函数想打印给调用者的结果"和"函数里想留给自己看的日志"——日志要写 stderr：`echo "debug" >&2`，否则会被 `$(...)` 吞进返回值里。
- 【追问】
  - 追问 1：`$(func)` 里函数中的 `local` 变量还能用吗？—— 能用，local 只是把作用域限制在函数内、函数结束即销毁；命令替换只是抓走 stdout，不影响作用域。
  - 追问 2：函数里的 `exit` 和 `return` 区别？—— `return` 只退出函数，`exit` 退出整个脚本。误把 `exit` 写在函数里会把整个流程干掉，这是常见事故。
- 【岗位标注】通用 / DevOps

### Q6. Shell 数组怎么用？什么时候用关联数组？

- 【考察点】会数组说明脚本水平到中级；不会的人只能用字符串拼接硬凑
- 【参考回答】索引数组：定义 `arr=(a b c)` 或 `arr[0]=a`，访问 `${arr[0]}`，全部元素 `${arr[@]}`，个数 `${#arr[@]}`，追加 `arr+=(d)`，切片 `${arr[@]:1:2}`；遍历用 `for x in "${arr[@]}"`——一定加引号，`"${arr[*]}"` 会把所有元素拼成一个词。关联数组 `declare -A map` 需要 bash 4+，`map[key]=value`、`${map[key]}`、`for k in "${!map[@]}"` 遍历键，适合"按 IP 记录状态"这类映射。生产例子：把一批主机名放数组，逐个 SSH 执行并记录每个的退出码，比字符串拼接干净得多。
- 【追问】
  - 追问 1：`"${arr[@]}"` 和 `"${arr[*]}"` 什么时候用哪个？—— 逐个传参、遍历用 `[@]`；想拼成一个字符串（比如拼日志行）用 `[*]`。
  - 追问 2：bash 3 没有关联数组怎么办？—— macOS 默认 bash 3，可以装新版 bash 或改用 Python；硬要用就两个并行数组或者 `eval` 模拟（不推荐）。
- 【岗位标注】通用 / 运维

### Q7. grep / sed / awk 三剑客各举一个你最常用的场景？

- 【考察点】文本处理是运维吃饭的本事，会问真实场景而不是背参数
- 【参考回答】grep 负责"过滤"：我最常用 `grep -E` 扩展正则 + `-v` 反选 + `-c` 计数，比如 `grep -c "ERROR" app.log` 数错误条数，`grep -rl "keyword" /etc/` 递归找文件；sed 负责"按行替换 / 取行"：`sed -i 's/^#ServerName/ServerName/' httpd.conf` 批量改配置，`sed -n '100,120p' app.log` 取日志区间，注意 `-i` 前先备份（`-i.bak`）；awk 负责"按列处理"：`awk '{print $1, $NF}'` 取第一列和最后一列，`awk -F: '{print $1}' /etc/passwd` 自定义分隔符，统计用 `awk '{sum+=$1} END{print sum}'`。一句话分工：grep 找行、sed 改行、awk 算列。
- 【追问】
  - 追问 1：统计每个 IP 的访问次数，一条命令怎么写？—— `awk '{print $1}' access.log | sort | uniq -c | sort -rn | head`；纯 awk 也行：`awk '{c[$1]++} END{for (k in c) print c[k], k}' access.log | sort -rn`。
  - 追问 2：`grep -P` 和 `grep -E` 的差别？—— `-P` 是 PCRE（Perl 正则，支持 `\d`、非贪婪等），`-E` 是 ERE（扩展正则）。生产上能用 `-E` 尽量用 `-E`，部分精简环境没有 PCRE。
- 【岗位标注】通用 / 运维 / 技术支持 / DevOps

### Q8. 管道和重定向：`>`、`>>`、`2>&1`、`tee`、管道退出码分别怎么回事？

- 【考察点】这是脚本里出错率最高的细节区，尤其 `2>&1` 的顺序问题是经典考点
- 【参考回答】先讲结论：`>` 截断写、`>>` 追加写、`2>` 重定向 stderr；`2>&1` 是把 stderr 指向"当前 stdout 的位置"——顺序很关键：`cmd >file 2>&1` 是 stdout 先进 file，stderr 再跟过去，两条都进文件；反过来 `cmd 2>&1 >file` 是先让 stderr 指向终端，再让 stdout 进文件，结果是 stderr 还留在屏幕上——这是经典翻车点。`tee` 是分流：`cmd | tee -a log` 既上屏又落盘。管道 `cmd1 | cmd2` 的退出码默认取最后一个命令，`grep foo | wc -l` 里 grep 挂了也显示成功——所以生产脚本要 `set -o pipefail`。日志场景推荐 `cmd >>app.log 2>&1` 的写法。
- 【追问】
  - 追问 1：`2>&1 | tee` 和 `|& tee` 一样吗？—— 一样，`|&` 是 `2>&1 |` 的简写（bash 特性）；POSIX sh 没有 `|&`。
  - 追问 2：如何同时拿到命令的 stdout 和退出码？—— 变量捕获 + 显式取值：`out=$(cmd); code=$?`，或 `if out=$(cmd); then ...`；要 stderr 一起捕获：`out=$(cmd 2>&1)`。
- 【岗位标注】通用 / 运维 / DevOps

### Q9. 进程与作业控制：`&`、`jobs`、`fg / bg`、`nohup`、`kill`、`wait` 怎么配合？

- 【考察点】后台任务管理是运维日常，也常被问"脚本里怎么并行"和"进程残留怎么清"
- 【参考回答】`cmd &` 放后台会返回 job 编号和 PID，`jobs` 看作业列表，`fg` / `bg` 前后台切换，Ctrl+Z 挂起；但运维脚本里更常用的是直接记 PID：`cmd & pid=$!`，最后 `wait $pid` 等它结束并取退出码。`nohup cmd &` 是防 SIGHUP（关终端不杀进程），输出默认进 nohup.out，建议写成 `nohup cmd >log 2>&1 &`。`kill` 默认发 SIGTERM（可以被 trap 优雅处理），`kill -9` 是 SIGKILL 强杀、不可捕获——生产教训：先 TERM 给清理留时间，不行再 -9。脚本要并行跑 N 个任务时，把 PID 存数组统一 `wait`，再汇总退出码。
- 【追问】
  - 追问 1：`nohup`、`setsid`、`disown` 的区别？—— 三者都是让进程脱离终端生命周期：nohup 忽略 SIGHUP；setsid 新建会话更彻底；disown 是 bash 内建，把作业移出 job 表，通常配合 `&` 使用。
  - 追问 2：脚本退出后子进程还活着，怎么清理？—— `trap 'kill 0' EXIT INT TERM`，`kill 0` 发信号给整个进程组；或者把子 PID 都记下来逐个 kill。
- 【岗位标注】通用 / 运维 / AI 运维

### Q10. `set -euxo pipefail` 分别干什么？生产脚本为什么推荐？

- 【考察点】判断脚本是否"生产级"的试金石，很多面试官第一句就问这个
- 【参考回答】先给结论：`set -e` 出错即退出——任何命令非 0 直接终止脚本；`set -u` 使用未定义变量报错而不是静默当成空串；`set -x` 打印每条命令的执行过程（调试用，生产一般不开）；`set -o pipefail` 管道中任一命令失败整体算失败。组合拳 `set -euo pipefail` 是生产 bash 脚本的标配开头，目的是"尽早失败、别带病运行"，避免变量拼错成空导致危险操作。但 `set -e` 有三个反直觉点：`if` 条件里的命令、`cmd || other` 的左边、以及 `grep 没匹配`这类"业务性非 0"都不会触发退出——所以不能无脑依赖 `-e`，关键命令要自己检查 `$?` 或显式 `|| exit`。
- 【追问】
  - 追问 1：`set -e` 下 `x=$(false)` 会退出吗？—— 会，赋值语句里命令替换失败会触发退出；但 `x=$(false) || echo ok` 不会（有 `||` 兜底，`-e` 对 `||` 左侧失效）。
  - 追问 2：管道里 `grep -v` 没输出算失败吗？—— 默认管道退出码取最后命令；配了 pipefail 后，grep -v 无匹配返回 1 就会让整个管道失败并触发 `-e`。过滤类命令要么放进 if，要么 `|| true`。
- 【岗位标注】通用 / 运维 / DevOps

### Q11. 脚本怎么调试？`bash -x`、`bash -n`、`trap` 怎么用？

- 【考察点】会调试 = 真写过脚本；只会写完就跑 = 新手
- 【参考回答】调试分三步：先 `bash -n script.sh` 做语法检查（只检查不执行）；再 `bash -x script.sh` 逐行打印展开后的命令（`+` 号开头，变量值都可见），这是定位"命令实际长什么样"的最快方式；局部调试可以在脚本里用 `set -x` / `set +x` 包住可疑段落。加餐：`trap 'echo "line $LINENO: $BASH_COMMAND"' DEBUG` 打印每条命令的行号，`trap cleanup EXIT` 保证退出时清理临时文件，`trap 'exit 130' INT TERM` 处理 Ctrl+C。生产经验：`bash -x` 输出量大，先 `bash -x script.sh 2>trace.log` 把跟踪写文件再慢慢看。
- 【追问】
  - 追问 1：`set -x` 会不会把密码打进日志？—— 会！`-x` 打印展开后的完整命令行，`mysql -p$PASS` 的密码直接可见。生产排查时留意，传密码用环境变量 + 脱敏，或交互输入。
  - 追问 2：`trap ... EXIT` 和直接把清理写在脚本末尾的区别？—— EXIT 陷阱在正常结束、`exit N`、被可捕获信号杀掉时都会执行，保证临时文件、锁文件一定被清理；写在末尾则中途退出就漏了。
- 【岗位标注】通用 / 运维 / 技术支持

### Q12. Python 基础：常用数据结构怎么选？给一段你写过的核心代码？

- 【考察点】确认 Python 不是"会抄"而是真写过；数据结构选型能看出工程思维
- 【参考回答】先给结论：list 存有序序列（遍历、append），dict 存键值映射（O(1) 查找，比如按文件名记状态），set 去重和存在性判断（`seen = set()` 比 `x in list` 快一个数量级），tuple 当不可变的小结构。看需求选型：按 IP 统计次数用 `collections.Counter`；按优先级取任务用 `heapq` 或 `queue.PriorityQueue`；先进先出用 `queue.Queue`（线程安全）。给一段我写拷贝工具时的核心代码：

```python
import os, shutil
from concurrent.futures import ThreadPoolExecutor

def copy_one(job):
    src, dst = job
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)   # copy2 保留 mtime 等元数据
    return dst

def main(src_root, dst_root, workers=8):
    jobs = []
    for root, _, files in os.walk(src_root):
        for f in files:
            sp = os.path.join(root, f)
            dp = os.path.join(dst_root, os.path.relpath(sp, src_root))
            jobs.append((sp, dp))
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(copy_one, jobs))
    print(f"done: {len(results)} files")
```

- 【追问】
  - 追问 1：`os.walk` 一次把所有文件都攒进内存，文件量巨大怎么办？—— 用 `os.scandir` 递归生成器，或者在线程池里"边走边投递"，配合有界队列 `queue.Queue(maxsize=1000)` 控制内存；百万文件不能全量进内存。
  - 追问 2：为什么拷贝用多线程而不是多进程？—— 拷贝是 I/O 密集，I/O 等待时线程会释放 GIL，多线程就能真正并行；多进程要复制解释器和内存，开销大、收益小。CPU 密集（压缩、hash 计算）才上多进程。
- 【岗位标注】通用 / AI 运维 / DevOps

## 三、进阶篇（12 题）

### Q13. Python 异常处理怎么写才算生产级？和 if 判断、返回码怎么取舍？

- 【考察点】异常处理是 Python 进阶分水岭；看会不会把错误信息留下来
- 【参考回答】结论：能用异常就用异常，不要用返回码和 if 层层判断——Python 的习惯是 EAFP（先做再捕获，Easier to Ask for Forgiveness than Permission）。生产级写法三要素：精确捕获——`except PermissionError` 而不是一把 `except Exception` 吞掉；保留上下文——`raise ... from e` 和 `logging.exception()`（自动带 traceback）；finally 兜底释放资源。外部资源（文件、连接、锁）用 `with` 语句自动管理。我的写法：

```python
import logging, shutil

class CopyError(Exception):
    pass

def copy_file(src, dst):
    try:
        shutil.copy2(src, dst)
    except FileNotFoundError as e:
        logging.error("源文件不存在: %s", src)
        raise CopyError(f"missing source: {src}") from e   # 保留原因链
    except PermissionError:
        logging.error("无权限: %s -> %s", src, dst)
        return False                 # 可恢复的错误，返回结果让调用方决定
    except OSError as e:             # 磁盘满、IO 错误等
        logging.exception("copy failed: %s -> %s", src, dst)
        raise                         # 严重错误向上抛，交给主流程重试或中止
```

- 【追问】
  - 追问 1：`except Exception` 和 `except BaseException` 的区别？—— 后者连 `KeyboardInterrupt`、`SystemExit` 也捕获，会吞掉 Ctrl+C 和 sys.exit，几乎永远不该用；`except Exception` 加 `logging.exception` 就够。
  - 追问 2：错误要不要重试？—— 瞬时错误（网络超时、文件占用、磁盘忙）可以指数退避重试（1s/2s/4s，加抖动）；确定性错误（路径不存在、参数错）重试无意义，直接失败记录。重试上限 3 次左右。
- 【岗位标注】通用 / AI 运维

### Q14. 装饰器和生成器各解决什么问题？各给一个你实际用过的例子？

- 【考察点】进阶语法是 Python 岗位的标配问题，八成会问
- 【参考回答】装饰器是"不改函数代码给函数加行为"，我最常用的是重试和计时；生成器是"惰性产出数据"，核心价值是省内存——百万行日志逐行 yield，而不是全读进内存。两个实战片段：重试装饰器用在网络请求上；生成器用在逐行处理日志：

```python
import time, functools, logging

def retry(times=3, backoff=1.0):
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*a, **kw):
            for i in range(times):
                try:
                    return fn(*a, **kw)
                except Exception:
                    if i == times - 1:
                        raise
                    time.sleep(backoff * (2 ** i))   # 指数退避
        return wrapper
    return deco

def iter_lines(path, chunk=64*1024):
    """生成器：逐行产出，任意大文件不爆内存"""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        while True:
            line = f.readline()
            if not line:
                break
            yield line.rstrip('\n')
```

- 【追问】
  - 追问 1：`functools.wraps` 是干什么的？—— 保留被装饰函数的 `__name__`、`__doc__` 等元信息；不加的话日志和调试里函数名全变成 wrapper，排查很痛苦。
  - 追问 2：生成器和迭代器的区别？—— 生成器是用 `yield` 写出来的迭代器；迭代器是实现了 `__iter__` / `__next__` 的对象，生成器是它的语法糖实现。
- 【岗位标注】通用 / AI 运维 / DevOps

### Q15. 说说 GIL，多线程和多进程怎么选？

- 【考察点】Python 并发必考题，能讲清 GIL 的适用范围 = 真的踩过并发坑
- 【参考回答】GIL 是 CPython 的全局解释器锁：同一时刻只有一个线程在执行 Python 字节码，所以纯 CPU 计算多线程不加速（甚至更慢）；但 I/O 操作（读文件、网络请求、sleep）会释放 GIL，I/O 密集任务多线程能真正并行。选型结论：I/O 密集（拷贝文件、调 API、读日志）用 `ThreadPoolExecutor`；CPU 密集（压缩、加密、hash、解析大文件）用 `ProcessPoolExecutor` 或多进程。补充一句：Python 3.13 开始有 free-threaded（无 GIL）实验构建，但生产选型还是按"I/O 线程、CPU 进程"来设计。
- 【追问】
  - 追问 1：多进程之间怎么传结果？—— `ProcessPoolExecutor.map` 直接收返回值；更复杂的共享用 `multiprocessing.Queue` 或 `Manager`，注意进程间传递的对象要能 pickle。
  - 追问 2：多线程要共享一个计数器怎么保证安全？—— 用 `threading.Lock` 保护，或者干脆用 `concurrent.futures` 的 `map` 把结果收回来、避免共享可变状态；无锁 `count += 1` 会丢更新。
- 【岗位标注】通用 / AI 运维

### Q16. Python 怎么调用外部命令？subprocess 的坑有哪些？

- 【考察点】运维脚本里调系统命令是刚需；shell=True 和超时是重点
- 【参考回答】首选 `subprocess.run`：`subprocess.run(["ls", "-l"], capture_output=True, text=True, timeout=10)`——`check=True` 时非 0 退出码抛 `CalledProcessError`，输出在 `.stdout` / `.stderr`；传参数一定用列表，不要拼字符串。三个大坑：1) `shell=True` 有注入风险（`; rm -rf` 直接执行）且引号地狱，能不用就不用；2) 只 `Popen` 不 `communicate()` 且输出量大时，管道写满会阻塞（死锁），用 `run` 或 `communicate(timeout=)`；3) `timeout` 触发 `TimeoutExpired` 后子进程可能还活着，要手动 `kill()` 清理。我的场景：脚本里调 `df`、`ip`、`systemctl` 拿结果做判断。
- 【追问】
  - 追问 1：为什么推荐列表传参而不是字符串？—— 列表直接走 exec，不经过 shell，无注入、无转义问题；字符串会经过 shell 解析，参数里的空格、`$`、反引号都是隐患。
  - 追问 2：需要和子进程交互（如 ssh 输密码）怎么办？—— 优先 `paramiko` 这类库而不是管道喂 stdin；实在要交互用 `pexpect`；生产上避免交互式命令。
- 【岗位标注】通用 / 运维 / AI 运维 / DevOps

### Q17. os / shutil / pathlib 三个模块怎么分工？文件操作常踩什么坑？

- 【考察点】文件操作是脚本核心，问模块分工能看出有没有工程经验
- 【参考回答】结论：pathlib 是新代码首选（Path 对象、`/` 拼接、`glob`、`read_text`），os 提供底层接口（os.rename、os.scandir、os.walk），shutil 负责高级文件操作（copy2、copytree、move、rmtree、disk_usage）。我的经验：跨目录拷贝用 `shutil.copy2`（保留时间戳），目录整体迁移用 `shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns('*.tmp'))`，删除用 `shutil.rmtree`。坑：同文件系统内 `os.rename` 原子且快，跨文件系统会报错，要用 `shutil.move`；`copytree` 目标已存在默认报错（要 `dirs_exist_ok=True`）；Windows 上文件被占用抛 PermissionError，要重试；路径超过 260 字符（长路径）需要 `\\?\` 前缀或开启系统长路径支持。
- 【追问】
  - 追问 1：pathlib 相比 os.path 拼接的优势？—— `Path` 用运算符 `/` 拼接，自动处理分隔符和规范化：`p / "sub" / "file.txt"`；os.path.join 是字符串拼接，多了容易错、可读性差。
  - 追问 2：怎么跳过"已存在且大小一致"的文件（断点续传的简化版）？—— 先 `os.path.exists(dst)`，再比较 `os.path.getsize(dst) == os.path.getsize(src)` 和 `os.path.getmtime`，一致就跳过。
- 【岗位标注】通用 / 运维 / 技术支持

### Q18. 为什么用 logging 而不是 print？生产日志怎么配？

- 【考察点】AI 运维和运维岗都会问，看会不会把日志写到文件并轮转
- 【参考回答】print 只有 stdout：没有级别、没有时间戳、没有文件轮转、多线程打印会乱；logging 开箱就有。生产配置三板斧：日志写文件、级别设置（生产 INFO、调试 DEBUG）、`RotatingFileHandler` 按大小轮转防磁盘爆掉。模板：

```python
import logging
from logging.handlers import RotatingFileHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[
        RotatingFileHandler("app.log", maxBytes=10*1024*1024, backupCount=5,
                            encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)
log.info("开始拷贝 %s -> %s", src, dst)   # 用 %s 占位，不要 f-string 拼
```

- 【追问】
  - 追问 1：多进程写同一个日志文件会乱吗？—— 会，RotatingFileHandler 在多进程下会串写；方案：每个进程写独立日志文件，或用 `QueueHandler` 把日志丢给一个专门的日志线程统一落盘。
  - 追问 2：日志里怎么避免泄漏敏感信息？—— 密码、token 不记日志；必须记就脱敏，比如 `re.sub(r'password=(\w+)', r'password=***', msg)`。
- 【岗位标注】通用 / AI 运维 / 运维

### Q19. 用 requests 调接口，超时、重试、异常处理怎么写才算合格？

- 【考察点】AI 运维必考；没配 timeout 直接判低分
- 【参考回答】三个硬要求：**必设 timeout**——连接和读超时分开设 `timeout=(3, 30)`，不设可能挂死几分钟；**连接复用**——用 `requests.Session()`，默认每个请求新建 TCP 连接，Session 复用连接池，批量请求快一个量级；**重试配退避**——用 urllib3 的 `Retry` 挂到 adapter 上。模板：

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

s = requests.Session()
retry = Retry(total=3, connect=2, read=2, backoff_factor=0.5,
              status_forcelist=[429, 500, 502, 503, 504],
              allowed_methods=["GET", "POST"])   # urllib3 1.x 里叫 method_whitelist
s.mount("https://", HTTPAdapter(max_retries=retry))

try:
    r = s.post(url, json=payload, timeout=(3, 30))
    r.raise_for_status()
    return r.json()
except requests.exceptions.Timeout:
    log.error("请求超时: %s", url)
    raise
except requests.exceptions.RequestException as e:
    log.exception("请求失败: %s", url)
    raise
finally:
    s.close()
```

- 【追问】
  - 追问 1：`status_forcelist` 里为什么有 429？—— 429 是限流，服务端明确要求退避重试；`Retry` 支持 `respect_retry_after_header=True` 时会遵守服务端给的 Retry-After。
  - 追问 2：下载大文件怎么不占内存？—— `r = s.get(url, stream=True, timeout=(5, None))`，然后 `for chunk in r.iter_content(chunk_size=1024*1024)` 分块写文件，不要用 `r.content` 一把梭。
- 【岗位标注】AI 运维 / 通用

### Q20. Python 做大数据量文件拷贝，性能上你会怎么设计？（思路题）

- 【考察点】直接对应简历的拷贝工具；先听思路，刁钻篇再深挖
- 【参考回答】设计原则是"减少系统调用、提高 IO 队列深度、别让 CPU 闲着"。四点：1) **大缓冲**——`shutil.copyfileobj` 或手动 `read(1MB)` 循环，而不是默认 8KB，系统调用次数直接降两个数量级；2) **多线程**——I/O 等待时释放 GIL，`ThreadPoolExecutor(8~16)` 并行拷不同文件，磁盘队列深度上去后吞吐上涨；3) **目录预创建**——`os.makedirs(exist_ok=True)` 先把目录树建好，避免每个文件现建目录；4) **预分配目标文件空间**（`os.truncate` / fallocate），减少写入时反复扩展。进阶选项：mmap 对随机访问友好但顺序拷贝不一定快；Linux 上 O_DIRECT 绕 page cache；Windows 上可调 `CopyFileExW` 或 `FILE_FLAG_NO_BUFFERING`。我的方法是先做基线再逐步加优化，每一步都用实测数据验证收益，避免拍脑袋。
- 【追问】
  - 追问 1：缓冲开多大合适？—— 64KB~1MB 之间收益最明显，再大边际收益递减；1MB 是稳妥默认值。
  - 追问 2：为什么"目录预创建"而不是边拷边建？—— 建目录要锁目录索引并写元数据日志；百万小文件边建边拷等于每个文件都做一次目录操作。预创建把这类元数据操作从热路径里拆出来。
- 【岗位标注】运维 / 技术支持 / AI 运维

### Q21. Shell 和 Python 什么时候用哪个？给个选型标准？

- 【考察点】考察工程判断力：工具选型错误是最常见的生产问题
- 【参考回答】结论先行：**胶水命令、一行式、管道组合、快速运维操作用 Shell**（`ps | grep`、批量改配置、cron 里的短任务）；**逻辑复杂、数据结构多、要并发、要异常处理、跨平台、要长期维护的用 Python**。判断标准三条：一是复杂度——超过 50 行、有循环嵌套字典、要解析参数，用 Python；二是健壮性要求——要重试、要异常分类、要日志轮转，Python 明显强；三是可移植性——Windows 下 bash 不通用，Python 一套代码两边跑。我的经验：能用一行 awk 解决就不开 Python 文件；但"超过一屏的脚本"直接 Python，避开 Shell 的引号地狱和 set -e 的各种反直觉。
- 【追问】
  - 追问 1：什么场景 Shell 反而比 Python 强？—— 文本流处理和管道组合（`find | xargs | grep | awk` 一条链），以及"已有命令能搞定"的场景：调 `jq`、`docker`、`systemctl` 输出，Shell 直接管道，Python 还得 subprocess 再解析。
  - 追问 2：性能要求高的批处理你选谁？—— 先想"能不能用现成工具"（rsync、robocopy、tar）；真要写，Python + 多进程/多线程做核心，Shell 只做调度壳。
- 【岗位标注】通用 / DevOps / 运维

### Q22. awk 进阶：NR / NF / FS / OFS / BEGIN / END 各是什么？给一个统计场景？

- 【考察点】三剑客的上限考察；会 awk 统计 = 运维基本功扎实
- 【参考回答】NR 是当前记录号（行号），NF 是当前行字段数，FS 是输入分隔符（默认空白），OFS 是输出分隔符，BEGIN 在处理前执行（放初始化），END 在所有行处理完后执行（放汇总）。`awk -F: '{print $1}' /etc/passwd` 等价于 `awk 'BEGIN{FS=":"} {print $1}'`。实战场景——统计日志里每个状态码的数量和占比：

```bash
awk '{c[$9]++} END{for (k in c) printf "%s %d (%.1f%%)\n", k, c[k], c[k]/NR*100}' access.log
```

按时间区间过滤：`awk '$4 ~ /^\[10\/May/ {c[$9]++}' access.log`。多文件时注意：`FNR` 是每个文件内的行号，`NR` 是跨文件累计行号，很容易混。
- 【追问】
  - 追问 1：awk 里怎么按条件输出并计数？—— 条件放 pattern 位置：`awk '$3 > 100 {n++} END{print n}' data`，pattern 为真才执行动作。
  - 追问 2：awk 和 cut 的区别？—— cut 只能按固定分隔符切列，awk 能做条件、统计、格式化（printf），是一个完整的小语言；能用 awk 就不需要 cut。
- 【岗位标注】运维 / 通用

### Q23. 重定向顺序、进程替换、here-doc 各有什么坑？给一个复杂用法？

- 【考察点】细节考察：重定向顺序是经典考点，进程替换是区分"真会用"的分水岭
- 【参考回答】重定向顺序前面讲过：`2>&1 >file` 和 `>file 2>&1` 结果完全不同，牢记"从右往左解读、先写先生效"。进程替换 `<(cmd)` 把命令输出虚拟成一个文件：`diff <(sort a.txt) <(sort b.txt)` 是经典用法，好处是不进管道、不启子 shell、循环里的变量改动在外面有效。here-doc 用 `<<EOF` 把多行文本喂给命令：

```bash
cat > /etc/yum.repos.d/local.repo <<'EOF'
[local]
name=local repo
baseurl=http://mirror.internal/centos
enabled=1
gpgcheck=0
EOF
```

注意 `<<'EOF'` 加引号则不做变量替换（配置里的 `$` 不会被吃掉），`<<-EOF` 忽略行首 tab。远程执行组合：`ssh host 'bash -s' <<'EOF' ... EOF`。
- 【追问】
  - 追问 1：`< <(cmd)` 和 `cmd | while ...` 的区别？—— 后者 while 跑在子 shell，循环内变量的修改外面拿不到；前者在当前 shell 执行，变量修改能保留。
  - 追问 2：here-doc 里想用变量又不想全部展开？—— 分隔符不加引号则全部展开；需要字面量的地方转义 `\$VAR`。
- 【岗位标注】运维 / DevOps

### Q24. 怎么让脚本幂等？单实例运行怎么保证？

- 【考察点】生产脚本规范核心；DevOps / 运维必问
- 【参考回答】幂等 = 同一操作执行多次，结果一致、无副作用。做法分几层：1) 操作前先判断——`mkdir -p` 天然幂等，写配置前先 `diff -q` 一致就跳过；2) 破坏性操作有保护——`rm -rf` 前先确认路径变量非空且存在，配 `set -u` 兜底；3) 支持重跑——日志用 append、临时文件用 `mktemp` 用完即删、失败记录到错误清单（下次跳过）。单实例用锁文件 + flock：

```bash
exec 9>/var/lock/myjob.lock
flock -n 9 || { echo "已有实例在运行"; exit 1; }
```

flock 的锁随 fd 自动释放——进程被 kill 也不残留死锁，比 `mkdir lock` 的旧模式稳。
- 【追问】
  - 追问 1：cron 里脚本跑超时了怎么办？—— 命令级 `timeout 3600 cmd`，或整体 `timeout 3600 script.sh`；再配合 flock 防止上次没跑完这次又起。
  - 追问 2：幂等和"失败重跑"怎么配合？—— 每批处理先写"已完成清单"（相对路径 + 大小 + mtime），重跑跳过匹配项，这就是断点续传的思路，比全量重来快得多。
- 【岗位标注】运维 / DevOps / 技术支持

## 四、生产实战·刁钻篇（10 题）

### Q25. 简历写"比资源管理器快 20%"，这个 20% 是怎么测出来的？

- 【考察点】数字真实性检验。面试官最想听：控制变量、可重复、别拿缓存骗人
- 【追问】
  - 追问 1：为什么不直接信任务管理器里的速度显示？—— 那是瞬时速度采样，波动大，还会把"复制进度条消失后的收尾时间"漏掉；必须用总耗时 / 总数据量算平均吞吐。
  - 追问 2：如果面试官说"你是不是正好测到缓存命中"？—— 我做了冷启动和交替执行，且把每轮耗时记录表留下来；另外换一批不同的文件再复测，两次结论一致才敢写进简历。
- 【岗位标注】运维 / 技术支持

### Q26. 说清楚你的工具为什么快？原理层面的三条？

- 【考察点】是不是真懂 IO，还是只抄了别人的方案。这是简历核心亮点的验证题
- 【参考回答】快的原因分三块，按贡献排序：第一，**资源管理器是单线程 + 每文件同步小缓冲，我的工具是多线程并行拷贝（8 个线程）**——机械硬盘的队列深度上去了，一个线程在等寻道时，另一个线程的数据正在传输，吞吐直接上一个台阶；第二，**减少系统调用和元数据开销**——我用 1MB 大缓冲读改写，一个文件就几次 read/write，而资源管理器默认小缓冲；目录树一次性预创建，避免每个文件现建目录；第三，**绕开资源管理器自带的额外开销**——explorer 会生成缩略图、检查 Zone.Identifier，还会被杀毒软件实时扫描钩子逐个文件过一遍，我的工具纯做数据搬运，测试时把目标目录加进杀软白名单。再深一层：小文件场景的瓶颈从来不在数据量，而在**元数据**（NTFS 的 MFT 条目分配、目录索引、日志写放大）和**随机寻道**（4KB 随机 IOPS 只有 50~100，寻道 5~10ms）——多线程 + 大缓冲恰好把这两块的时间重叠掉了。
- 【追问】
  - 追问 1：多线程在 HDD 上不是会增加寻道吗？—— 会增加，所以线程数要调：我实测 8 线程最好，16 线程收益变平甚至下降。关键是多线程让"一个线程等在寻道时，另一个线程在传数据"，整体吞吐是涨的；但线程过多会变成寻道风暴，这个我用不同线程数的 AB 测试确认过。
  - 追问 2：资源管理器真的一点优势都没有吗？—— 有：explorer 在目标盘空间不足、权限变化、同名冲突时处理得更完善。纯速度场景我的工具赢，可靠性场景 explorer 赢——所以我做的是"快拷贝"，不做"复杂合并"。
- 【岗位标注】运维 / 技术支持

### Q27. 你的工具在什么情况下会反而比资源管理器慢？说过"精通"就要知道边界

- 【考察点】反直觉追问：敢不敢承认方案有边界。答"任何情况都快"直接暴露不懂 IO
- 【参考回答】会的，我主动说边界：第一，**文件量极少但单个文件巨大**（比如一个 50GB 的镜像）——大家都打到顺序 IO 物理上限，多线程没有用武之地，基本持平；第二，**源和目标在同一块机械硬盘的不同分区**——磁头要在读写之间来回切换，并发越高互相拖累越狠，这时单线程可能更快；第三，**目录结构极深、文件名极复杂**（含换行符等）——我脚本里的遍历和路径处理会变慢，而 explorer 有内核路径；第四，**网络盘（SMB / NFS）**——协议和网络才是瓶颈，客户端怎么优化都白搭；第五，**目标盘碎片严重**时写入分布随机，需要预分配空间才能缓解。所以我的结论是"大量小文件 + 本地机械盘 + 普通目录树这个特定场景快 20%"，这句话我简历上就是这么写的，不普适。
- 【追问】
  - 追问 1：工具里有没有防这些场景的开关？—— 有：`--workers` 可调线程数，`--single` 退化单线程，还检测"源和目标是否同盘"（比较 `os.stat` 的 st_dev）给出警告。
  - 追问 2：用户拷到一半发现慢了，你怎么帮他定位？—— 任务管理器看磁盘队列长度和 `MsMpEng.exe`（Defender）的 CPU，先排除杀软；再看是不是跨盘；最后检查碎片（`defrag /U`）。
- 【岗位标注】运维 / 技术支持

### Q28. 拷贝到一半断电 / 进程被杀怎么办？断点续传具体怎么做？

- 【考察点】真实生产最关心的问题：数据安全。无断点续传 = 工具不完整
- 【参考回答】我的方案是"清单 + 跳过"两层：工具启动时先扫描源目录，把每个文件的相对路径、大小、mtime 写进 checkpoint 清单（JSON，每 5000 条 flush 一次，防止进程被杀丢进度）；拷贝时先检查目标：存在且"大小一致 + mtime 一致"就跳过——这是快速近似校验，够用于续传；全部跑完后生成"未完成清单"（失败 / 跳过原因），重跑时直接读清单续传。中断处理的细节：每个文件的拷贝用 `try/finally`，finally 里把该文件标记为未完成；进程收到 SIGINT/SIGTERM 时用 `signal` 处理器设置停止标志，线程拷完当前文件就退出，保证"没有半截文件被当成完成"——半截文件通过大小不一致会在下一轮被自动重拷。要求更强一致性时可以加 per-file hash 校验，代价是时间翻倍，我做成可选开关 `--verify`。
- 【追问】
  - 追问 1：为什么用"大小 + mtime"而不是只比大小？—— 只比大小会漏掉"同大小不同内容"的被修改文件；mtime 在 NTFS 是 100ns 精度，够用。比 hash 快太多（hash 要读全文件）。
  - 追问 2：checkpoint 本身写坏了怎么办？—— 写临时文件再原子改名（`os.replace`）；读失败就全量重扫——最坏情况只是重来一遍，不会丢数据。
  - 追问 3：拷完要不要做全量 hash 校验？—— 默认不做：百万小文件全量 md5 的耗时和拷贝本身差不多甚至更久，对"快拷贝"是自杀。分三档：默认"大小 + mtime"快速校验（开销近零，能拦 99% 的拷贝问题）；`--verify` 严格模式只对"新增 / 修改过的"文件做 blake2b 校验（多线程并行 hash，只输出差异报告，不阻塞主流程）；更优的架构是传输层块级校验——每块带 CRC32（类似 rsync），成本低还能定位坏块。校验要和续传结合：跳过的文件默认信"大小 + mtime"，`--verify` 时对跳过的也抽验。
  - 追问 4：md5 和 sha256 怎么选？—— 校验完整性（防误码）md5 够用，sha256 慢 5~10 倍；防恶意篡改才需要 sha256；blake2b 更快且强度够，Python 内置 `hashlib.blake2b`。时间紧就抽样校验：每目录随机抽 5%~10% 做全量 hash，出问题再扩大范围。
- 【岗位标注】运维 / 技术支持

### Q29. 文件名里有空格、单引号、换行符，你的脚本怎么处理？

- 【考察点】文件处理的老坑，看会不会用 NUL 分隔和 -print0
- 【参考回答】核心原则：**永远不要用空格或换行做分隔，用 NUL（\0）**。Shell 侧的完整写法：

```bash
find "$src" -type f -print0 | while IFS= read -r -d '' f; do
    rel="${f#"$src"/}"
    cp "$f" "$dst/$rel"
done
```

`-print0` 输出 NUL 分隔，`read -d ''` 按 NUL 读，`-r` 保留反斜杠，`"$f"` 全程加引号防分词——任何文件名都安全。Python 侧没有 shell 分词烦恼（路径是 str 不是 shell 词），但要小心：`os.walk` 出来的名字直接 `os.path.join`，别自己拼字符串；写日志时把路径里的换行符转义（`repr(path)` 或 `replace('\n', '\\n')`），不然日志被文件名里的换行拆散。还有一个 Windows 特有坑：文件名以点结尾或含尾随空格（NTFS 允许）在部分 Win32 API 下会被静默截断，拷贝后要校验目标名和源名是否一致。
- 【追问】
  - 追问 1：`for f in $(find ...)` 为什么不行？—— 命令替换结果按空白分词，空格和换行全裂，还会被通配符展开（文件名含 `*` 时），这是最经典的错误写法。
  - 追问 2：xargs 怎么配合？—— `find ... -print0 | xargs -0 -P 8 -n 1 process_file.sh`：`-0` 对应 NUL 分隔，`-P` 并行度，`-n 1` 每个参数单独执行一次命令。
- 【岗位标注】运维 / 通用

### Q30. 脚本被 kill -9 了，子进程和临时文件残留怎么办？信号处理怎么写？

- 【考察点】信号处理和清理设计，生产踩坑高发区
- 【参考回答】分两层处理：**可捕获的信号**（TERM、INT）用 trap 做优雅退出；**kill -9** 谁都拦不住，只能靠"自愈设计"。先说 trap：

```bash
exec 9>/var/lock/myjob.lock
flock -n 9 || { echo "已有实例在运行"; exit 1; }

cleanup() {
    local rc=$?               # 第一行就存退出码，否则被下面的命令覆盖
    rm -rf "${TMPDIR:-/tmp/mytool.$$}"
    exit "$rc"
}
trap cleanup EXIT             # 任何退出路径都清理
trap 'exit 130' INT TERM      # 信号进来也走 EXIT 清理
```

再说防 -9 的招：1) 临时文件放 `mktemp -d` 创建的目录，下次启动时发现残留且对应 PID 已死（`kill -0 $pid` 检测）就清理掉再跑；2) 子进程用 `wait` 收尸，Python 里手写 `Popen` 记得 kill 后 `communicate()` 回收，`subprocess.run` 本身不留孤儿；3) 关键中间产物先写临时名，完成后 `os.replace` 原子改名——即使被 -9，目标目录里永远只有完整文件，不会有半截文件。
- 【追问】
  - 追问 1：`trap 'cleanup $?' EXIT` 里的 `$?` 在函数里还能拿到吗？—— 不能，函数第一行就要 `local rc=$?` 存下来，否则函数内部任何命令都会覆盖退出码。
  - 追问 2：孤儿进程怎么定位清理？—— `ps -ef | grep 脚本名` 找父进程为 1 的残留，或 `pkill -f`；根治靠"等齐"设计：所有子进程都 `wait` 住再退出。
- 【岗位标注】运维 / DevOps

### Q31. 磁盘满了、目标文件被占用、权限不足，你的工具分别怎么处理？

- 【考察点】异常分类处理，看会不会把所有错误都 `except Exception` 一把吞
- 【参考回答】我的处理按"可恢复 / 可跳过 / 致命"三级分类：**可恢复**——目标文件被占用（Windows 共享冲突，PermissionError / errno 32、33）退避重试 3 次（1s / 2s / 4s），还不行就记入失败清单，最后统一重试；**可跳过**——个别文件权限不足（ACCESS_DENIED），记录后继续，不中断整个任务，结束时报告"N 个失败，按原因分类"；**致命**——磁盘满（写入返回 ENOSPC）是整批失败的信号，立即停止新任务、保存 checkpoint、退出码 2，绝不死循环重试。落盘前的预防：开始前用 `shutil.disk_usage(dst)` 估算剩余空间，不够直接拒绝启动；拷贝中每个文件都检查返回值。日志格式固定为"时间 | 文件 | 错误码 | 动作"，方便事后 grep 统计。
- 【追问】
  - 追问 1：磁盘满的判断为什么不能只看 disk_usage 预检？—— 预检只是降低概率：拷贝过程中别的进程可能写满，配额（quota）、FAT32 的 4GB 单文件限制都可能在写入时才暴露，所以写失败要按 ENOSPC 单独分类，而不是混进通用 OSError。
  - 追问 2：失败清单重试时如果还是失败？—— 三次重试后输出失败报告文件（相对路径 + 原因），退出码约定：0 全部成功、1 部分成功（有失败清单）、2 致命失败——退出码语义写进工具 README，方便 CI / 批处理调用方判断。
- 【岗位标注】运维 / 技术支持

### Q32. 你说多线程快，那为什么有些场景多线程拷贝反而更慢？HDD 的 IOPS 和寻道怎么算？

- 【考察点】反直觉深度题，验证是不是真懂机械盘物理特性
- 【参考回答】机械盘的性能由两个物理数字决定：**寻道时间 5~10ms**、**4KB 随机 IOPS 约 50~150**（顺序吞吐 100~160MB/s）。多线程的价值是"把寻道等待叠起来"：一个线程等磁头移动时，另一个线程的数据可能已经在缓存里，所以队列深度从 1 提到 4~8，吞吐明显上涨。但过了临界点就反噬：线程太多 → 每个文件分散在盘上 → 磁头在 N 个位置间来回飞 → 寻道时间占比飙升 → 总吞吐掉头向下；再加上写放大（NTFS 日志、MFT 更新、目录索引重排），并发高时元数据操作互相抢锁。所以我实测 8 线程封顶，16 线程反而更慢；**同盘读写**（源和目标一个盘）时并发惩罚最重——磁头来回换方向，寻道成本翻倍，4 线程以下甚至单线程更好。判断依据：`iostat` 的 `await` 在并发上去后暴涨而吞吐不涨，就是寻道饱和，该降并发。
- 【追问】
  - 追问 1：SSD 上同样逻辑成立吗？—— 不成立：SSD 无寻道，随机 4K IOPS 几万到几十万，多线程多队列深度直接拉满利用率，16、32 线程都行；但小文件场景的元数据开销仍在，收益没有 HDD 那么"起死回生"。
  - 追问 2：计算题：4KB 文件、磁头寻道 8ms，纯随机读写一个文件约耗时多少？理论每秒多少个文件？—— 一个文件约 8ms（4KB 传输时间相对寻道可忽略），1 秒约 125 个文件；10000 个 4KB 文件理论最快约 80 秒——这就是为什么小文件场景的关键指标是"文件数 / 秒"而不是 MB/s。
  - 追问 3：拷到一半变慢了，你会用什么命令排查？—— Linux 侧：`iostat -x 1` 看 `%util`（饱和度）、`await`（IO 等待，机械盘 10ms 以上说明在排队）、`rkB/s / wkB/s` 吞吐；`iotop` 看谁在抢 IO（可能有别的备份任务）；`strace -c -p <pid>` 按系统调用统计——有一次我们排查出来是每个文件都调了一次 `fsync`，直接慢了 10 倍；`free -h` 看 page cache 是否被挤爆导致写回风暴。Windows 侧：任务管理器性能页看"活动时间"和队列长度，进程页看 `MsMpEng.exe`（Defender 实时扫描是头号嫌疑，拷文件时 CPU 飙升就是它）；`perfmon` 加 PhysicalDisk 计数器。找到瓶颈再对症：杀软 → 加白名单；缓冲太小 → 改 1MB；并发过高 → 降线程数；同盘拷贝 → 换盘。另外 `iostat` 里 %util 100% 不一定有问题：SSD 高 %util 但延迟低是正常的（NVMe 队列深度高），机械盘 %util 高 + await 高才是真的饱和。
- 【岗位标注】运维 / 技术支持

### Q33. 有人说 mmap 拷贝更快，你用了没有？mmap 的坑在哪？

- 【考察点】简历工具的技术深挖：mmap 是进阶 IO 的高频考点，能分清"快在哪、慢在哪"才是真懂
- 【参考回答】我做过对比实验，结论是**顺序拷贝场景 mmap 通常不比 read/write 快，甚至更慢**，所以我的工具没用 mmap。原因：mmap 的优势是"按需加载 + 随机访问友好 + 零拷贝共享"，但对顺序大流量拷贝有硬伤——1) 每访问一页（4KB）都可能触发缺页中断（page fault），顺序读时相当于按页做小 IO；2) mmap 写让脏页异步回写，回写时机不受你控制，磁盘压力可能集中爆发；3) 读和写同时 mmap 时 page cache 占用翻倍（源一份目标一份），大文件下反而挤爆缓存；4) 文件长度变化时映射管理复杂，还有 SIGBUS 风险。实测同一个 10GB 顺序拷贝，`read/write + 1MB 缓冲` 明显优于 `mmap 逐页拷贝`。mmap 的正确用法是：随机访问大文件（如读数据库文件某几页）、进程间共享内存。直接 IO（O_DIRECT）是另一个方向：绕过 page cache 减少双份缓存，但要求缓冲区对齐，且 HDD 场景瓶颈在寻道不在缓存，收益有限；Windows 上 Python 没有现成 O_DIRECT，要 ctypes 调 CreateFile 的 FILE_FLAG_NO_BUFFERING——我调研过但没有上线，因为 read/write + 大缓冲已经够用。
- 【追问】
  - 追问 1：什么情况下 mmap 会赢？—— 大量随机读 + 只读（搜索引擎读索引、数据库读页），mmap 省去每次 read 的系统调用和内存拷贝，靠 page cache 命中；以及要共享内存做进程通信时。
  - 追问 2：你的工具最终用的什么 IO 模型？—— 多线程 + 每线程 `shutil.copyfileobj` 1MB 缓冲（底层是 read/write 循环），加上目录预创建和断点清单；mmap 和 O_DIRECT 都在实验分支里验证过，没有进主版本。
- 【岗位标注】运维 / 技术支持 / AI 运维

### Q34. 描述一次你被线上问题逼着改代码的经历（脚本健壮性考察）

- 【考察点】行为面试 + 技术结合的压轴题，看真实性、复盘能力和"精通"的含金量
- 【参考回答】真实案例：工具第一版上线后，用户反馈"拷到某个目录就卡死不动"。排查过程：先看日志发现卡在同一个文件上，任务管理器显示磁盘队列满、线程一直等 IO——不是死锁，而是**坏扇区导致的无限重试**：我的重试逻辑对磁盘硬件错误（EIO）也重试 3 次，但该文件在坏道上每次 read 都失败，反复重试拖死了整个线程池。修复分三层：1) **错误分类**——`EIO`（硬件错误）、`ENOSPC`（空间不足）划为"不可恢复 / 致命"，立刻终止该文件并记录，不再重试；`EACCES`、共享冲突划为"可重试 / 可跳过"；2) **单文件失败上限**——任何文件最多重试 3 次后进失败清单，绝不无限重试；3) **失败清单支持单独重跑**——`--retry-failed` 只重跑失败的，`--skip-bad` 跳过坏文件，让用户"先拿 99.9% 的数据，坏盘的事交给检测工具"。这个事故让我学到：**重试是双刃剑，只对瞬时错误重试；错误分类表要写进代码注释**。之后我加了故障注入测试：用坏盘 / 满盘 / 权限全错的目录各跑一遍。
- 【追问】
  - 追问 1：这个事故有没有造成数据损失？—— 没有：写失败时目标文件是半截的，但"临时名 + 完成后 os.replace"的设计保证了半截文件不会伪装成成功，用户重跑后补齐。这也是我把断点续传做成默认特性的原因。
  - 追问 2：如果再给你一次机会，第一版哪里会改？—— 错误分类表和重试策略一开始就设计进去，而不是上线后补；另外上线前会做一轮故障注入测试。
- 【岗位标注】运维 / 技术支持
