---
title: Ansible 面试问答（34 题）
date: 2026-08-27 09:15:00
categories: 技术
password: buzhidao
tags:
  - Ansible
  - Linux
  - 面试
  - 私密

---

本文整理了Ansible 面试问答（34 题）相关的 34 个高频面试问题，从基础到进阶再到生产实战层层递进，覆盖Ansible、Linux、面试等核心考点，每题附参考回答与追问，适合面试前系统复习。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

---

## 一、岗位高频速查

| 岗位 | 必考问题（3-5 个） | 一句话要点 |
| --- | --- | --- |
| 运维工程师 | 1. Ansible 架构：控制节点/受管节点、为什么无 agent<br>2. 常用模块与幂等性原理<br>3. Inventory 主机组与变量怎么组织<br>4. 批量操作 + 滚动更新实战（serial、失败处理）<br>5. 故障排查（SSH、提权、语法报错） | 核心是"能否把日常批量化工作写成可复用 playbook，并讲清执行流程与故障处理"，会被要求举真实场景 |
| 技术支持工程师 | 1. 用大白话给客户/同事讲 Ansible 是什么<br>2. ad-hoc 命令快速排查（ping、磁盘、服务）<br>3. playbook 报错怎么读、怎么定位<br>4. 客户机器环境特殊（无 Python、无外网）怎么办<br>5. 密钥/免密配置问题排查 | 重沟通表达与排查路径，不深究原理，重点是"怎么解释清楚 + 怎么快速验证" |
| AI 运维工程师 | 1. GPU 服务器批量初始化：驱动/CUDA 环境编排<br>2. 异构 inventory（每台 GPU 型号/内核不同）怎么建模<br>3. 模型服务的滚动更新与回滚<br>4. Ansible 与 K8s/GPU 集群的衔接（节点初始化、标签）<br>5. 大批量并发与限流（forks/serial/throttle） | 重点在"异构环境建模 + 驱动/依赖幂等 + 大规模并行与风险控制"，会追问 nvidia-smi 验证、内核匹配 |
| DevOps 工程师 | 1. 与 Terraform、CI/CD 的分工与集成<br>2. roles 组织、代码复用、ansible-lint<br>3. ansible-vault 密钥管理与 CI 注入<br>4. 幂等性与"基础设施即代码"理念<br>5. 滚动更新策略、失败自动止损 | 重工程化：代码组织、安全、可测试、可追溯，会聊方法论和工具链协同 |
| 数据库/网络等专项岗位 | 低频，了解即可 | 只要会讲"用 Ansible 批量改配置、用 systemd/service 模块管服务"即可 |

---

## 二、基础篇

### Q1. 简单介绍下 Ansible 的架构？控制节点和受管节点上分别需要什么？

- 【考察点】是否真理解"推模式 + 无 agent"模型，而非只会背概念。
- 【参考回答】Ansible 是主从结构，但和传统 C/S 不一样，它是推模式：控制节点（我平时工作的机器或跳板机）装 Ansible，受管节点什么都不用装，只要开 SSH、有 Python 就行。控制节点通过 SSH 把模块（本质是 Python 脚本）推到受管节点执行，执行完就删掉，不留任何驻留进程，所以叫"无 agent"。关键记忆点：控制节点需要 Ansible 本体 + Python 3，受管节点只需要 SSH + Python（2.10 之后基本要求 Python 3）；传输默认走 OpenSSH，也可以指定 paramiko。
- 【追问】
  - 受管节点没 Python 怎么办？→ 用 `raw` 模块直接跑裸命令先装 Python，或者用 `ansible-pull` 从 Git 拉 playbook 本地执行。
  - Windows 能当受管节点吗？→ 可以，但不走 Python/SSH，走 WinRM + PowerShell，用的是 `ansible.windows` 集合的模块。
  - SSH 之外还支持什么连接方式？→ `local`、`winrm`、容器 `containers`（podman/docker）、网络设备 `network_cli` 等连接插件。
- 【岗位标注】通用 / 运维 / DevOps

### Q2. Ansible 为什么不需要装 agent？它和 SaltStack、Puppet 有什么区别？

- 【考察点】对 Agent 架构（pull 模式）与无 agent 架构（push 模式）取舍的理解。
- 【参考回答】Puppet/Chef 是受管节点装常驻 agent，定期去 master 拉配置（pull 模式），还带证书体系；SaltStack 默认也装 minion，走 ZeroMQ 消息队列，通信比 SSH 快很多，适合超大集群。Ansible 选无 agent 是因为部署成本最低：只要 SSH 通就能管，控制节点是唯一信任点，安全边界清晰，对存量异构机器友好；代价是每次执行都要重新建立 SSH 连接、走加密通道，规模化后性能不如 agent 类，所以大集群要靠 pipelining、ControlPersist、fact caching 来补。另一个本质区别：Ansible 写的是"目标状态"，模块自己判断要不要改，这是它和纯脚本的本质不同。
- 【追问】无 agent 是不是就没法做持续合规（drift 检测）？→ 可以，靠 cron 定期跑 `ansible-pull`，或用调度平台（AWX/Tower、Jenkins）定时执行 playbook，实现配置漂移校正。
- 【岗位标注】通用 / 运维

### Q3. Inventory（主机清单）是什么？主机组、嵌套组、变量怎么组织？

- 【考察点】Inventory 基本语法、分组、连接变量。
- 【参考回答】Inventory 就是主机清单，默认 INI 格式，也支持 YAML。主机可以带连接变量 `ansible_host`、`ansible_user`、`ansible_ssh_private_key_file`、`ansible_port`。分组用 `[组名]`，嵌套组用 `[父组:children]`，组变量用 `[组名:vars]`，`all` 是内置的全体组。我之前 RKE2 集群的 inventory 就是这么写的：master 组、worker 组，再用 `[rke2:children]` 聚合，每台机器还挂了 `custom_hostname` 这类自定义变量，模板里直接用：
```ini
[master]
master1 ansible_host=10.20.80.160

[worker]
worker1 ansible_host=10.20.80.161
worker2 ansible_host=10.20.80.163

[rke2:children]
master
worker

[rke2:vars]
k8s_version=1.28
```
- 【追问】Inventory 里的变量和 playbook 里定义的变量谁优先？→ 简单版：playbook 的 `vars` 优先于 inventory 变量，命令行 `-e` 最高，详细优先级后面 Q9/Q19 讲。
- 【追问】怎么验证 inventory 分组对不对？→ `ansible-inventory --list` 或 `ansible all --list-hosts`。
- 【岗位标注】运维 / DevOps

### Q4. 你平时最常用的模块有哪些？分别什么场景？

- 【考察点】模块覆盖面，是否真的用过而不是只背名字。
- 【参考回答】按用途分类记：文件类 `copy`/`file`/`template`/`lineinfile`/`fetch`；软件类 `yum`/`apt`/`package`；服务类 `service`/`systemd`；用户类 `user`；执行类 `command`/`shell`/`script`/`raw`；信息类 `ping`/`setup`。举具体用法：`copy` 传配置文件（自动比对校验和、幂等）；`template` 渲染带变量的配置；`lineinfile` 改单行（比如改 sshd 的 Port）；`file` 建目录、建软链、删文件；`systemd` 管服务（`daemon_reload`、`enabled`）；`user` 建账号（注意密码要传哈希）；`fetch` 从远端拉文件回控制节点，比如批量收集日志。
- 【追问】copy 和 template 的区别？→ copy 是原样传文件，文件里不能有变量；template 会先做 Jinja2 渲染再传，适合"同一个模板、每台机器变量不同"的场景。
- 【追问】模块名记不全怎么办？→ `ansible-doc -l` 列全部，`ansible-doc <模块名>` 看用法和参数，这是 RHCE 也教的用法。
- 【岗位标注】通用 / 运维

### Q5. command 和 shell 模块有什么区别？什么时候必须用 shell？

- 【考察点】对模块底层机制和安全性的理解。
- 【参考回答】`command` 直接执行命令，不做 shell 解释，所以管道、重定向、通配符、`&&`/`||` 都不支持；但正因如此它更安全，不会踩 shell 特殊字符、注入的坑，是默认推荐。`shell` 走 `/bin/sh` 解释，能跑管道重定向和复杂逻辑，但有 shell 相关的坑。另外两个都不是幂等模块，每次都会执行，要幂等得靠 `creates`/`removes` 参数或 `when` 条件自己判断。
- 【追问】什么时候必须用 shell？→ 要管道（`df -h | grep /data`）、重定向（`echo x >> file`）、通配、复杂脚本逻辑的时候；单条简单命令永远优先 command。
- 【追问】command 里想用环境变量？→ 用任务级的 `environment` 关键字传，或者改用 shell。
- 【岗位标注】通用 / 运维 / DevOps

### Q6. Playbook 是什么？YAML 有哪些容易踩的坑？

- 【考察点】Playbook 三段结构 + YAML 语法细节。
- 【参考回答】Playbook 是 YAML 文件，顶层是 play 列表，每个 play 有 `hosts`/`tasks`（还可以有 `become`、`vars`、`handlers`），tasks 里每个任务至少要有名字和模块调用。最小例子：
```yaml
---
- name: 部署 nginx
  hosts: webservers
  become: yes
  tasks:
    - name: 安装 nginx
      yum:
        name: nginx
        state: present
```
YAML 的坑：缩进只能用空格不能用 tab（统一两空格）；`yes`/`no`/`on`/`off` 在 YAML 1.1 里会被解析成布尔值，想当字符串必须加引号（比如 `version: "yes"`）；值里带冒号加空格、`#`、`{{ }}` 时要引号包住。
- 【追问】任务的 name 不写行不行？→ 语法上行，但生产上必须写，报错定位和代码阅读全靠它，`ansible-lint` 也会警告。
- 【追问】怎么检查语法？→ `ansible-playbook --syntax-check`，再配合 `--list-tasks`/`--list-hosts` 预览。
- 【岗位标注】通用

### Q7. Facts 是什么？gather_facts 什么时候该关？

- 【考察点】Facts 机制和性能意识。
- 【参考回答】Facts 是 Ansible 在每个 play 开头通过 `setup` 模块自动采集的受管节点信息，包括 IP、内存、CPU、磁盘、OS 发行版、架构等，存在变量里，名字以 `ansible_facts` 开头，比如 `ansible_facts['os_family']`（兼容写法 `ansible_os_family`）。典型用法：按系统类型走不同分支——RedHat 用 yum、Debian 用 apt；取 IP 生成配置文件。生产上如果任务根本不需要 facts，就 `gather_facts: false` 关掉，省时间；需要的时候可以用 `gather_subset` 只采集部分（比如 `gather_subset: "!all,min"`）。
- 【追问】facts 采集慢，几百台机器每次都采怎么办？→ 开 fact caching（jsonfile 或 redis），`gathering` 设为 `smart`，只在首次采集。
- 【岗位标注】运维 / DevOps

### Q8. Handlers 是什么？和普通 task 有什么区别？notify 怎么用？

- 【考察点】"只在变更时执行"的触发机制。
- 【参考回答】Handler 是"只在变更时执行的 task"。普通 task 每次执行都会跑，handler 靠 `notify` 触发：某个 task 执行完状态是 `changed`，就通知对应的 handler，等这个 play 的所有 task 跑完后，被通知的 handler 统一执行。典型场景：改完 nginx 配置 notify 重启 nginx；同一 handler 被多个 task notify 也只执行一次：
```yaml
tasks:
  - name: 更新 nginx 配置
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
    notify: restart nginx
handlers:
  - name: restart nginx
    systemd:
      name: nginx
      state: restarted
```
- 【追问】handler 为什么放在 play 末尾执行？→ 减少重启次数，保证一次 play 内配置全部就位再动作；想中途执行用 `meta: flush_handlers`。
- 【岗位标注】运维 / DevOps

### Q9. Ansible 的变量有哪些来源？优先级怎么排？

- 【考察点】变量体系与优先级，这是面试高频。
- 【参考回答】变量来源很多：inventory 里的主机/组变量、`group_vars/` 和 `host_vars/` 目录、play 的 `vars`、`vars_files`、命令行 `-e`、`register` 注册结果、facts。优先级记几个关键的（从低到高）：role 的 `defaults` 最低 → inventory 组变量 → inventory 主机变量 → play 的 `vars` → `vars_files` → `register`/`set_fact` → 命令行 `-e` 最高、永远赢。所以"临时覆盖"就用 `-e`，比如 `ansible-playbook site.yml -e "env=prod"`。
- 【追问】`-e` 传的和配置文件里同名变量用哪个？→ 用 `-e` 的，extra vars 最高优先级，这也是环境注入的常用手段。
- 【追问】group_vars 目录怎么组织？→ 项目根目录建 `group_vars/all.yml`、`group_vars/webservers.yml`、`host_vars/web1.yml`，分别对应 all 组、webservers 组、具体主机。
- 【岗位标注】运维 / DevOps

### Q10. 条件 when 和循环 loop 怎么用？举个例子。

- 【考察点】条件/循环语法与真实写法。
- 【参考回答】`when` 做条件判断，多个条件写列表就是 and 关系，支持 `in`/`not in`/正则 `match`：
```yaml
- name: RedHat 系安装 nginx
  yum:
    name: nginx
    state: present
  when: ansible_facts['os_family'] == "RedHat"
```
循环用 `loop` 传列表，任务里用 `item` 取值，配 `loop_control` 让输出可读：
```yaml
- name: 批量建用户
  user:
    name: "{{ item }}"
  loop:
    - zhangsan
    - lisi
```
- 【追问】循环里想同时拿到"用户和组"两个值？→ `loop` 里传字典列表，用 `item.name`/`item.group`，或用 `dict2items`、`subelements` 过滤器。
- 【追问】`when` 条件里的变量未定义会报错吗？→ 会，先用 `when: my_var is defined` 或者 `| default()` 兜底。
- 【岗位标注】通用 / 运维

### Q11. template 和 Jinja2 是干什么的？举一个实际例子。

- 【考察点】模板渲染、过滤器、真实使用场景。
- 【参考回答】`template` 模块把 Jinja2 模板渲染后传到受管节点，模板里可以用变量 `{{ }}`、条件 `{% if %}`、循环 `{% for %}`，还有过滤器如 `default`（默认值）、`join`、`upper`、`to_json`、`regex_replace`。真实例子：我给 RKE2 集群写 hosts 文件时，模板里循环 `groups['all']` 生成所有节点记录，每台机器渲染结果按 `inventory_hostname`/`custom_hostname` 不同而不同，加新节点只要改 inventory，重跑模板自动更新所有机器。另一个例子：nginx 配置模板里放 `{{ server_name }}`、`{{ listen_port }}`，不同站点传不同变量复用同一模板。
- 【追问】模板渲染时变量未定义会怎样？→ 默认直接报错 undefined variable；想给默认值用 `{{ var | default('xxx', true) }}`，`true` 表示变量不存在时也给默认。
- 【追问】dest 目录不存在？→ 先加一个 `file` 模块建目录，或用 `directory_mode` 确保父目录就位。
- 【岗位标注】运维 / DevOps

### Q12. ad-hoc 命令怎么用？比如快速批量看磁盘、装包、重启服务。

- 【考察点】日常快速操作能力，技术支持岗必考。
- 【参考回答】ad-hoc 就是一行命令完成单任务，不写 playbook：
```bash
ansible all -m ping                          # 批量测连通
ansible all -m command -a "uptime"           # 批量看负载
ansible webservers -m shell -a "df -h | grep /data"   # 批量看磁盘
ansible all -m yum -a "name=vim state=present" --become   # 批量装包
ansible all -m systemd -a "name=nginx state=restarted" --become  # 批量重启服务
```
加 `-i` 指定 inventory、`--limit` 限定主机、`--forks` 控制并发。日常排查、小批量操作特别快；多步骤、要复用的就写成 playbook。
- 【追问】ad-hoc 怎么带变量？→ `-e "var=value"`。
- 【追问】怎么以 root 执行？→ `--become`（或 `-b`），配 `--become-user=root`。
- 【岗位标注】通用 / 技术支持

---

## 三、进阶篇

### Q13. 幂等性是什么？Ansible 怎么保证幂等？哪些模块天然不幂等？

- 【考察点】核心概念 + 模块机制，面试必考。
- 【参考回答】幂等 = 同一个操作执行 N 次，结果和状态都和执行 1 次一致。Ansible 的模块基本都是"声明目标状态"：模块先探测当前状态，只有不一致才动手，所以每次跑要么 `ok` 要么 `changed`，重复跑不会重复生效。比如 `yum` 配 `state: present`，已装就 ok；`copy` 比对校验和；`lineinfile` 检查行是否存在；`user` 比对属性。不幂等的是 `command`/`shell`/`raw`/`script` 这些裸命令——它们每次都会执行，得自己用 `creates`/`removes`、`register` + `when`、`changed_when` 控制。
- 【追问】怎么验证一个 playbook 是幂等的？→ 连跑两遍，第二遍所有任务都应该是 ok 而不是 changed，这是我生产上的验收标准。
- 【追问】changed 一定代表有问题吗？→ 不一定，但生产变更要走变更记录，所以配合 `--diff` 看具体改了什么。
- 【岗位标注】通用 / 运维 / DevOps

### Q14. 一个 playbook 从执行到结束，完整的执行流程是什么？

- 【考察点】执行模型：facts → tasks → handlers、forks、serial、strategy。
- 【参考回答】一次执行大致是：读 inventory 和 playbook → 建立 SSH 连接（可复用连接池）→ 每个 play 默认先 gather facts（除非关闭）→ 按 tasks 顺序执行，受 `forks` 并发数控制（默认 5 台一组）→ 每个 task 把结果回传控制节点 → 所有 task 跑完（或中途失败停止）→ 被 notify 的 handlers 在 play 末尾执行 → 下一个 play 重复。分批靠 `serial`（如 `serial: 10` 或 `serial: "20%"`）；执行策略默认 `linear`（一批里所有主机都完成当前任务才进下一任务），可改 `free` 让快的先走；还有 `--check`/`--diff`/`--step` 这些执行期参数。
- 【追问】serial 和 forks 的区别？→ forks 是并发窗口（同时连多少台），是资源/性能控制；serial 是把主机分批（一次只动一批），是业务风险控制，用于滚动更新。
- 【岗位标注】运维 / DevOps

### Q15. roles 的目录结构是什么？每个目录的作用？

- 【考察点】roles 标准结构，RHCE 必考项。
- 【参考回答】roles 把 playbook 按功能拆成可复用单元，标准目录：
```text
roles/nginx/
├── tasks/main.yml      # 主任务，唯一必选
├── handlers/main.yml   # handler
├── defaults/main.yml   # 默认变量（最低优先级，可被覆盖）
├── vars/main.yml       # 角色变量（高优先级，一般不让外部覆盖）
├── files/              # 原样传输的文件
├── templates/          # Jinja2 模板
├── meta/main.yml       # 依赖声明、作者信息
└── library/ module_utils/  # 自定义模块（高级）
```
用 `ansible-galaxy init nginx` 生成骨架，playbook 里 `roles: - role: nginx` 引用，可以带参数；依赖用 `meta/main.yml` 的 `dependencies` 声明。
- 【追问】defaults 和 vars 的区别？→ defaults 优先级最低、调用方传参就能覆盖，放"可定制项"；vars 固定，放不该被改的内部逻辑变量。
- 【岗位标注】运维 / DevOps

### Q16. Tags 是干什么的？--tags / --skip-tags / always？

- 【考察点】标签机制和大 playbook 的按需执行。
- 【参考回答】Tags 给任务打标签，执行时用 `--tags` 只跑打了标签的任务，或 `--skip-tags` 跳过，适合大 playbook 里挑单步执行。比如部署流程拆成 `install`/`config`/`restart` 三个 tag，日常只跑 `config`。tag 可以打在 task、play、roles 上；打 `always` 标签的任务任何情况下都跑（比如装基础依赖）。命令示例：`ansible-playbook site.yml --tags "config"`、`ansible-playbook site.yml --skip-tags "restart"`，`--list-tags` 可以预览。
- 【追问】tag 打在 play 上和打在 task 上的区别？→ 打在 play 上会继承到它内部所有任务；task 上的 tag 更细粒度。
- 【岗位标注】运维 / DevOps

### Q17. ansible-vault 怎么用？多环境密钥怎么管理？

- 【考察点】加密机制、多环境密钥隔离、CI 集成。
- 【参考回答】ansible-vault 用 AES-256 加密文件或单值，解密在控制节点内存完成、不落盘。用法：`ansible-vault create secrets.yml` / `encrypt` / `decrypt` / `edit` / `view` / `rekey`；单值用 `echo -n 'xxx' | ansible-vault encrypt_string` 生成 `!vault` 开头的加密串。跑 playbook 时 `--ask-vault-pass` 交互输密码，或 `--vault-password-file` 指定密码文件；多环境建议用 vault-id 隔离：`--vault-id dev@prompt --vault-id prod@prompt`，防止误用生产密钥。加密的 vars 文件用 `vars_files` 引用，playbook 里直接当变量用。密码文件本身权限 600、不进 Git，CI 里用 secret 注入或由 runner 持有。
- 【追问】vault 密码丢了怎么办？→ 无解，所以密码文件要有备份/由密码管理器托管；`rekey` 只能换密码，不能找回。
- 【追问】vault 变量在调试输出里会不会泄露？→ 正常输出会打码，但如果 debug 打印了变量会把解密值打出来，所以敏感任务加 `no_log: true`。
- 【岗位标注】运维 / DevOps

### Q18. check 模式和 --diff 是什么？生产上怎么用？

- 【考察点】变更前演练与可观测性。
- 【参考回答】`--check` 是 dry-run，模块只报告"会做什么"、不改系统；`--diff` 显示文件类任务的改动内容（前后对比）。生产习惯：上线前必跑 `ansible-playbook site.yml --check --diff`，人工确认 diff 里没有意外改动，再正式执行。坑：check 模式下 `command`/`shell` 默认直接跳过（报 skipped），无法验证结果；部分模块（如某些 service）在 check 模式也会报 changed；handler 在 check 模式不执行。所以 `--check` 通过不等于真的没问题，关键任务建议先拿一台真机验证。
- 【追问】想让某个任务在 check 模式也真执行？→ 任务级 `check_mode: false` 覆盖。
- 【岗位标注】运维 / DevOps

### Q19. 变量优先级完整讲一遍？register 和 set_fact 的区别？

- 【考察点】优先级链 + 运行期变量。
- 【参考回答】完整优先级从低到高核心几档：role 的 `defaults` → inventory 组变量 → inventory 主机变量 → play 的 `vars` → `vars_files` → role 的 `vars` → task 内 `vars` → `include_vars` → `set_fact`/`register` → role/include 传参 → extra vars（`-e`，最高）。`register` 是把任务结果存成变量，比如 command 的 `stdout`、`rc`，后面 `when: result.rc != 0` 判断；`set_fact` 是运行期手动造变量，可以跨 play 用，配合 `cacheable: yes` 还能进 fact 缓存。
- 【追问】怎么调试变量？→ `debug` 模块：`debug: var=my_var` 或 `debug: msg="{{ my_var }}"`，再加 `-v` 提升详细度。
- 【岗位标注】运维 / DevOps

### Q20. 几百台机器批量执行太慢，怎么优化？

- 【考察点】性能调优的实操参数。
- 【参考回答】慢主要慢在 SSH 连接建立和 facts 采集。按性价比排序：1) ansible.cfg 开 `pipelining = True`，减少 SSH 往返次数（要求 sudoers 关掉 `requiretty`）；2) ssh_args 加 `-o ControlMaster=auto -o ControlPersist=60s`，复用连接；3) `forks` 从默认 5 提到 20~50（注意控制节点资源）；4) 不需要 facts 就 `gather_facts: false`；5) 需要 facts 就开 fact caching（jsonfile 或 redis）+ `gathering = smart`；6) 大文件避免每次全量 copy，可以压缩或用 `rsync` 传输。我实际跑 100+ 台时，开 pipelining + ControlPersist 后单轮任务耗时下降非常明显。
- 【追问】forks 开太大有什么风险？→ 控制节点连接数/内存暴涨，目标端可能被连接风暴打挂，建议配合 `throttle` 和 `serial` 限流。
- 【岗位标注】运维 / DevOps / AI 运维

### Q21. Handler 有哪些坑？不执行、执行时机、失败处理。

- 【考察点】对 handler 边界行为的掌握，属于"答得好加分"的题。
- 【参考回答】常见坑：1) handler 没触发——因为 notify 它的 task 状态是 ok（没 changed）就不会通知，或 handler 名字拼错；2) 多个 task notify 同一 handler 只执行一次，这是特性不是 bug；3) handler 默认在 play 末尾跑，但 play 中途有 task 失败时，已 notify 的 handler 默认不会执行——导致"配置改了服务没重启"，生产上关键 play 我会加 `force_handlers: true` 保证"配置已改则服务一定重启"；4) 想在 play 中间立即执行用 `meta: flush_handlers`；5) handler 里还能再 notify 别的 handler 形成链式，但别搞成循环。
- 【追问】怎么确认 handler 到底跑没跑？→ 看执行输出里 handler 的 changed/ok 状态，加 `-v` 或给 handler 打 tag。
- 【岗位标注】运维 / DevOps

### Q22. Playbook 的错误处理：ignore_errors、any_errors_fatal、block/rescue/always、retries？

- 【考察点】失败策略与重试机制。
- 【参考回答】默认行为是"一台失败停这台，其他主机继续当前任务"（linear 策略下按批次推进）。控制手段：`ignore_errors: yes` 忽略单任务失败继续跑（慎用，会掩盖问题）；`any_errors_fatal: yes` 任何一台失败就整体停止；`block`/`rescue`/`always` 三段式（类似 try/catch/finally），rescue 里做回滚或补偿、always 里做清理；任务级 `retries`/`until`/`delay`/`register` 做重试，比如等服务就绪：`until: result.stdout.find("ready") != -1, retries: 10, delay: 3`；`max_fail_percentage` 配 `serial` 用：一批里失败比例超阈值就中止整个 play。
- 【追问】回滚一般怎么做？→ 在 rescue 里做，或单独写回滚 playbook；生产上配合备份（copy 的 `backup: yes` 或先 tar 打包）实现配置回退。
- 【岗位标注】运维 / DevOps

### Q23. 动态 Inventory 是什么？怎么用？

- 【考察点】云环境下的主机动态管理。
- 【参考回答】主机是动态的（云上自动伸缩），静态文件维护不来，用动态 inventory：Ansible 2.4+ 用 inventory plugin，比如 `aws_ec2` 插件按 region/tag 拉主机，搭配 `constructed` 插件把标签映射成组和变量。在 ansible.cfg 的 `enable_plugins` 里启用，执行时 `ansible-playbook -i aws_ec2.yml site.yml`；老式方案是 inventory 脚本返回 JSON。好处：伸缩出来的机器自动纳入管理，分组自动随标签变化。
- 【追问】动态 inventory 和 Terraform 怎么配合？→ Terraform 产出 inventory 文件，或直接用云插件按 tag 拉，避免两套清单不一致。
- 【岗位标注】DevOps / 运维

### Q24. Ansible 和 Terraform 有什么区别？为什么简历里两个都写？

- 【考察点】工具定位与协同，DevOps 岗必考。
- 【参考回答】Terraform 管"基础设施的创建"：VPC、ECS、RDS、安全组这些云资源，它声明式、有 state 文件做漂移检测、plan/apply 双阶段、资源不可变替换；Ansible 管"机器内部的状态"：装软件、改配置、起服务、滚动发布。Terraform 不关心机器里装了什么，Ansible 不关心机器是谁建的。最佳实践是组合：Terraform 建好云资源和机器、输出 IP，Ansible 接棒做初始化（装 agent、下发配置、部署应用）。所以两个都写是互补不是重复。
- 【追问】Terraform 的 provisioner 不是也能配置机器吗？→ 官方都不推荐，state 不可追踪、幂等差，配置的事交给 Ansible 等配置管理工具。
- 【追问】滚动更新谁做更合适？→ 应用/配置层面用 Ansible（serial 分批 + LB 摘挂）；基础设施层面（如 ASG 滚动替换实例）用 Terraform/云平台。
- 【岗位标注】DevOps / AI 运维

---

## 四、生产实战·刁钻篇

### Q25. 你在生产环境用 Ansible 实际做过什么？描述一次真实的批量操作。

- 【考察点】验证简历"掌握 Ansible"的真实性，最常问的开场题，答不出细节基本翻车。
- 【参考回答】我在驻场项目里管过一套 RKE2 集群的运维，机器分 rancher、harbor、master、worker 几类。我建了 inventory 分组（master/worker，用 `rke2:children` 聚合），ansible.cfg 里统一配了 remote_user 和 become 默认提权。做过最典型的批量操作：一是全集群时区同步，一个 playbook 用 `timezone` 模块直接设 Asia/Shanghai，所有节点一遍跑完，重跑全部是 ok；二是 hosts 管理，用 template 渲染 hosts 模板，模板里循环 `groups['all']` 生成每台机器的记录，加新节点只要改 inventory，重跑模板自动同步到所有机器。这些文件在我的 automation 仓库里，是真实落地过的。"掌握"对我意味着能写出可复用、重跑幂等的 playbook，而不是只会跑 ad-hoc。
- 【追问】时区那个 playbook 里你引了一个 root 密钥的 vars 文件，为什么？→ 那是实验阶段为集群节点免密提权准备的；生产上我改成 SSH 密钥 + vault 管理，密码方式只留在测试环境。诚实讲清边界比硬撑加分。
- 【追问】你那套 inventory 一共几台机器？→ 初期五台左右（rancher、harbor、master1、worker1、worker2），后面按需扩。数字具体、前后一致即可。
- 【岗位标注】运维 / DevOps

### Q26. 这个写法有没有隐患？`template` 配 `when: inventory_hostname in groups['all']`。

- 【考察点】反直觉代码审查：条件恒真、模板必要性、系统文件风险。照简历里的真实仓库问。
- 【参考回答】有几点可以说：第一，`when: inventory_hostname in groups['all']` 对任何受管主机都恒为真（它们必然在 all 组里），这个条件等于没写，是冗余代码——真实场景应该用 `group_names` 判断节点类型，比如只在 worker 组执行；第二，如果模板内容对所有机器渲染结果一样，那不如直接用 `copy` 传静态文件，`template` 的价值在于"每台机器渲染出不同的内容"（比如用 `custom_hostname` 区分）；第三，写 `/etc/hosts` 这类系统文件有风险：要么用 `lineinfile` 只加自己要的条目，要么先备份（`copy backup: yes`）再替换，否则会覆盖别人维护的条目；而且 hosts 这类文件可能被容器网络插件、cloud-init 重写，所以我生产上写自定义的 `/etc/myhosts` 让应用读取，避免和系统管理冲突。最后，生产上我会先 `--check --diff` 预览、再限 `serial` 分批，出问题能快速回滚。
- 【追问】那你自己项目里为啥还这么写？→ 实验环境验证写法，当时想把所有机器都纳入模板输出，后来发现等价于 copy 就改了。承认并给出改进，自圆其说。
- 【追问】你 ansible.cfg 里全局开了 `become = True`，有什么隐患？→ 全局默认提权容易误伤：只读任务也以 root 跑、权限面过大、审计困难；生产上我建议任务级显式声明 `become`，或者按角色分组配置。这是个加分回答。
- 【岗位标注】运维 / DevOps

### Q27. 滚动更新怎么做？serial、max_fail_percentage、LB 摘挂、健康检查。

- 【考察点】大规模发布的风险控制，DevOps 核心题。
- 【参考回答】滚动更新的核心是"随时有可用服务"。playbook 层面：`serial: "20%"` 或 `serial: [1,5]` 分批推进，配 `max_fail_percentage` 止损，每批做"摘流 → 更新 → 验证 → 挂回"：用 `delegate_to: localhost` 操作负载均衡（nginx upstream 或云 LB），把该批节点从 upstream 摘掉 → 跑更新任务 → 用 `uri` 模块 curl 本地健康检查 → 挂回。骨架：
```yaml
- hosts: app
  serial: 2
  max_fail_percentage: 25
  tasks:
    - name: 摘除 LB
      command: /opt/lb_api.py remove {{ inventory_hostname }}
      delegate_to: localhost
    - name: 更新服务
      systemd:
        name: myapp
        state: restarted
    - name: 健康检查
      uri:
        url: http://127.0.0.1:8080/health
        status_code: 200
    - name: 挂回 LB
      command: /opt/lb_api.py add {{ inventory_hostname }}
      delegate_to: localhost
```
- 【追问】批次里有一台挂了怎么处理？→ `max_fail_percentage` 超了整体中止；没超就跳过挂掉的继续；回滚 = 停掉后续批次，用旧版本重跑。
- 【追问】怎么避免用户流量打到新旧混合版本？→ 那是版本兼容性问题，Ansible 层面只能靠 LB 灰度；版本不兼容时用蓝绿部署（整组切换）而不是滚动。
- 【岗位标注】DevOps / 运维 / AI 运维

### Q28. 批量执行中有一台机器挂了，会发生什么？.retry 文件是什么？

- 【考察点】失败行为与断点续跑。
- 【参考回答】默认行为：该主机当前 task 失败后，本 play 对它停止，其他主机继续；linear 策略下 Ansible 等这批主机完成当前任务再推进下一任务，失败主机被排除。结束后（开启 `retry_files_enabled` 时）会在 `~/.ansible/retry/` 生成 `<playbook>.retry` 文件，里面是失败主机列表；修复后可以 `ansible-playbook site.yml --limit @site.retry` 只补跑失败主机，这就是"从上次失败处继续"。`--limit` 也可以直接指定补跑目标。
- 【追问】想"一台失败全体停止"怎么办？→ `any_errors_fatal: yes`。
- 【追问】批处理中断了，重跑会不会重复执行已完成的操作？→ 不会，幂等模块重跑是 ok；非幂等的 command/shell 要用 `creates`/`removes` 保证可重入。
- 【岗位标注】运维 / DevOps

### Q29. 报 "Host key verification failed" / SSH 连不上，完整排查路径？

- 【考察点】技术支持岗的排查思路。
- 【参考回答】按层排查：1) 网络层：先 ping、`ssh -v` 手动连看具体报错；2) host key 问题：报 "Host key verification failed" 说明 known_hosts 里没有或指纹变了，`ssh-keygen -R <host>` 清掉旧记录，或 `ssh-keyscan` 重新采集；Ansible 侧测试环境可 `host_key_checking = False`；3) 认证问题：报 permission denied，检查 `ansible_user`、密钥路径 `ansible_ssh_private_key_file`、密码认证需要控制节点装 `sshpass`；4) 提权问题：become 失败多半是 sudo 需要密码（`--ask-become-pass`）或 sudoers 里开了 `requiretty`，或用户不在 sudo 组；5) Python 问题：远端报 python not found，先 `raw` 装 Python；6) 其他：端口不是 22（配 `ansible_port`）、ansible.cfg 配错。排查工具：`ansible <host> -m ping -vvv` 看详细过程。
- 【追问】几百台新机器首次连接怎么批量解决 host key？→ 一次性 `ssh-keyscan -f inventory` 生成 known_hosts 分发，或内网环境接受风险直接 `host_key_checking = False`。
- 【岗位标注】技术支持 / 运维

### Q30. 客户/生产机器上没有 Python 怎么办？

- 【考察点】最小化系统、离线环境的应对。
- 【参考回答】受管节点只要 SSH 能连上，第一步可以用 `raw` 模块（纯 SSH 裸命令，不依赖远端 Python）去装 Python：`raw: yum install -y python3` 或 `apt-get update && apt-get install -y python3`，装完再跑正常 playbook。客户环境完全离线就准备离线 rpm/deb 包或内网镜像源。还有 `ansible-pull` 模式：不用控制节点推送，目标机器定时从 Git 拉 playbook 本地执行（配 cron），适合控制节点连不到目标、网络隔离的场景。另外很多网络设备、Windows 走的是 `network_cli`/`winrm` 连接插件，本来就不走 Python。
- 【追问】raw 和 command 的区别？→ raw 连远端 Python 都不需要，直接拼 shell 命令；command 需要远端有 Python，由 Ansible 包装执行。
- 【岗位标注】技术支持 / 运维

### Q31. AI 运维：几十台 GPU 服务器批量装驱动/CUDA，怎么做才幂等？内核不匹配的坑。

- 【考察点】异构环境建模 + 驱动依赖的幂等处理，AI 运维岗必考。
- 【参考回答】GPU 服务器初始化最怕"每台硬件不一样"。做法：inventory 里每台机器用主机变量描述硬件（`gpu_model`、`driver_version`、`cuda_version`），playbook 按变量走分支：先确认内核版本（`uname -r` 要和驱动包要求的 kernel-devel 匹配），装 kernel-devel、dkms，再装驱动（官方 repo 或离线 rpm），装完用 `nvidia-smi` 验证，输出注册到变量判断是否 changed；CUDA 装好后写入 `/etc/profile.d`。幂等关键：`nvidia-smi` 已输出目标版本就 skip。批量 50 台以上时 `serial` 分批、`--check` 预览、失败 `any_errors_fatal` 避免一半机器驱动不一致。
- 【追问】内核升级后驱动会怎样？→ dkms 会自动重建内核模块，但必须验证；没有 dkms 就得重装驱动，所以生产上要么锁内核版本，要么 dkms + 重启后加验证 task。
- 【追问】驱动装完要重启才能生效，Ansible 怎么处理？→ 用 `reboot` 模块（配 `reboot_timeout`/`post_reboot_delay`）分批重启，避免全集群同时重启全挂。
- 【岗位标注】AI 运维

### Q32. 配置下发后没生效，或者过几天被改回去了，怎么排查？

- 【考察点】反直觉点：幂等 ≠ "配置恒为期望值"，最容易暴露理解深度。
- 【参考回答】这是"幂等"最容易被误解的地方：Ansible 只在执行的那一刻保证目标状态，执行之后其他进程/运维/云平台可能把配置改回去，Ansible 不会自动发现。排查路径：1) 重跑一遍 playbook，看是否又 changed——如果又 changed，说明有东西在持续改写它；2) 用 `--diff` 看具体差异；3) 排查"写方"：应用启动时重写配置（比如 kubelet/容器网络插件维护 `/etc/hosts`、cloud-init 每次启动重写 `/etc/resolv.conf`）——所以 resolv.conf 这类文件应该走云平台/NetworkManager 管理，而不是 Ansible 硬写；4) 对策：a) 用系统原生的管理通道（NetworkManager、systemd-resolved、kubelet 参数）；b) 写只读保护 `chattr +i`；c) 定期跑合规 playbook 校正漂移（cron + ansible-pull 或调度平台）；d) 改完立即验证。我项目里 hosts 就走"自定义 `/etc/myhosts` + 应用读取"的隔离方案，就是为了不和 kubelet 打架。
- 【追问】那"幂等"到底保证了什么？→ 保证"我执行的那一刻"结果一致且可重复，不保证"之后没人动"；所以生产上要有 drift 检测/定期校正。
- 【岗位标注】运维 / AI 运维

### Q33. 密钥管理：vault 密码放哪？CI/CD 里怎么注入？泄露了怎么处理？

- 【考察点】安全意识与工程实践。
- 【参考回答】原则：密钥不进 Git，控制节点是最小信任面。vault 密码文件放控制节点 `~/.ansible/`、权限 600，或由公司密码管理器托管；多环境用 vault-id 分离（dev/prod 不同密钥，防误用生产密钥）。CI/CD 里：GitLab CI 用 project secret 存 vault 密码，runner 启动时写入临时文件、用完即删，执行 `ansible-playbook --vault-password-file $VAULT_PW_FILE`；或者用 AWX/AAP 的 credential 管理。泄露处理流程：1) 立即 `ansible-vault rekey` 换密码（所有加密文件都要重加密）；2) 泄露的是 SSH 机器密钥就吊销并全量换 key；3) 审计接触面、检查日志脱敏（`no_log: true`）、排查是否进过 `-v` 输出或 CI 日志；4) TLS 私钥这类秘密建议不进 vault 文件，直接用外部 secret manager 运行时注入。
- 【追问】vault 加密的是整个文件，能不能只加密一个值？→ 可以，`ansible-vault encrypt_string` 生成 `!vault` 前缀的加密串，嵌在明文 yaml 里。
- 【岗位标注】DevOps / 运维

### Q34. 你说你考了 RHCE——RHCE 到底考了什么？RHCSA 和 RHCE 的区别？

- 【考察点】证书真实性 + 考点记忆 + 诚实度，针对简历表述的深挖。
- 【参考回答】我考的是 RHEL 9 对应的 RHCE，考试编号 EX294（课程 RH294，红帽现在也有含考试的组合班 RH295），考的就是"用 Ansible 自动化系统管理"：写 playbook、inventory 管理、变量与 facts、条件循环、handlers、Jinja2 模板、roles、ansible-vault、RHEL System Roles（比如 timesync、selinux、network），以及常用系统管理模块和排错。RHCSA（EX200）考的是手工系统管理：文件权限、LVM、用户组、systemd 服务、SELinux。一句话：RHCSA 考"人肉运维"，RHCE 考"用 Ansible 自动运维"。实践中我用得最熟的是 inventory 分组 + playbook 批量配置（集群时区同步、hosts 管理真实落地过），roles 和 vault 是考完后在工程里补强过的。如果面试官追问考试细节，我会直接说哪些考纲我实际用过、哪些只停留在考试层面，不硬撑。
- 【追问】RHCE 还有其他方向吗？→ 有，红帽还有 Ansible Automation Platform 方向的认证（考 AWX/AAP 平台操作），那是另一条线，我考的是 RHEL 自动化这条线。诚实说明边界。
- 【追问】EX294 里记得哪些具体任务类型？→ 比如：按条件装包、批量建用户并设密码哈希、用模板生成配置文件、用 selinux 模块配置 SELinux 布尔值、写 role 并传参调用、vault 加密文件后解密运行。这些我都能复述做法。
- 【岗位标注】通用

---
