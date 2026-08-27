---
title: Docker 面试问答（34 题）
date: 2026-08-27 09:05:00
categories: 技术
password: buzhidao
tags:
  - Docker
  - 面试
  - 私密

---

本文整理了Docker 面试问答（34 题）相关的 34 个高频面试问题，从基础到进阶再到生产实战层层递进，覆盖Docker、面试等核心考点，每题附参考回答与追问，适合面试前系统复习。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

---

## 一、岗位高频速查

| 岗位 | 必考问题（3-5 个） | 一句话要点 |
| --- | --- | --- |
| 运维工程师 | ① 容器与虚拟机区别 ② 镜像分层与 overlay2 ③ 资源限制（--memory/--cpus）与 OOM 排查 ④ 日志膨胀与日志轮转 ⑤ Docker 与 containerd/CRI 的关系 | 侧重生产排障与资源管理，会被追问"100% 容器化"里数据库、存储怎么处理 |
| 技术支持工程师 | ① docker run 常用参数 ② 如何进容器排查（exec/logs）③ 端口映射与卷挂载 ④ docker-compose 启动一套服务 ⑤ 容器起不来的常见原因 | 侧重能上手操作、帮客户定位问题，深度要求低但命令必须熟 |
| AI 运维工程师 | ① 容器资源限制与 GPU 共享（--cpus/--memory/--gpus）② /dev/shm 太小与多进程共享内存 ③ 镜像瘦身与模型镜像（几个 GB 的 PyTorch 镜像）④ 日志与监控采集 ⑤ 用 compose/K8s 部署 LLM 推理服务 | 侧重内存/性能/大镜像，会被追问数据加载、共享内存、OOM 场景 |
| DevOps 工程师 | ① Dockerfile 最佳实践与多阶段构建 ② CI/CD 中镜像构建（GitLab CI + Harbor）③ docker-compose 编排与依赖 ④ HEALTHCHECK 与优雅停机 ⑤ 镜像安全（扫描、签名、不可变 tag） | 侧重构建流程、流水线、仓库管理与发布，会被追问缓存与瘦身细节 |

---

## 二、基础篇（12 题）

### Q1. 什么是 Docker？容器和虚拟机有什么区别？

- 【考察点】基本概念是否清楚，能否一句话讲清"进程级隔离 vs 硬件级虚拟化"
- 【参考回答】我理解容器本质上是"被隔离的一组进程"：它和宿主机共享内核，通过命名空间做隔离、cgroup 做资源限制，所以启动只要秒级、镜像只要几十 MB。虚拟机则是硬件级虚拟化，有完整的 Guest OS，隔离更彻底但启动要几十秒、占用几个 GB。所以我们的选型原则是：需要内核隔离、要跑不可信代码、要独立内核的场景用虚拟机；普通业务服务全部容器化，资源利用率高、交付快。Docker 本身 = 镜像 + 容器 + 仓库 + 客户端/守护进程这一整套。
- 【追问】既然共享内核，为什么容器里能跑 CentOS、Ubuntu 不同发行版？
  - 答：共享的是内核，不是用户态。不同 base image 只是用户态的工具链和 glibc 版本不同，最终系统调用都走宿主机内核。反过来也说明：如果应用依赖特定内核版本、内核模块或设备驱动，容器就跑不了，这是容器化的边界。
- 【追问】什么场景下容器不如虚拟机？
  - 答：跑不可信代码、需要强隔离、需要独立内核（比如老内核模块依赖）时；还有 Windows 容器在 Linux 宿主上跑不了这种平台限制。
- 【岗位标注】通用

### Q2. 镜像和容器是什么关系？

- 【考察点】是否理解"镜像=只读模板，容器=可写运行实例"
- 【参考回答】镜像是分层的只读模板，由 Dockerfile 一步步构建出来，可以 push 到仓库分发；容器是镜像启动后的运行实例，等于"镜像只读层 + 一个容器可写层 + 运行时状态（进程、网络、挂载）"。同一个镜像可以同时起几十个互不影响的容器。排查问题常会用到：把容器文件系统打包成镜像用 docker commit，但生产发布我从来不用它，因为不可复现，只用来临时保存排障现场。
- 【追问】docker commit 和 docker build 有什么区别？
  - 答：commit 是把某个容器的可写层直接提交成新镜像，黑盒、不可复现；build 是按 Dockerfile 从零构建，可审计可缓存，才是正规发布路径。
- 【岗位标注】通用

### Q3. docker run 最常用的参数有哪些？

- 【考察点】基本功是否扎实，能否一口气说出常用参数并解释含义
- 【参考回答】我常用的：`-d` 后台运行、`-p 宿主机端口:容器端口` 端口映射、`-v 宿主机路径:容器路径` 挂载卷、`-e KEY=VALUE` 传环境变量、`--name` 命名、`-it` 交互式终端（进容器调试）、`--rm` 退出即删（临时容器）、`--restart=always` 设置重启策略、`--network` 指定网络、`--memory/--cpus` 资源限制。举个例子：`docker run -d --name nginx --restart=always -p 80:80 -e TZ=Asia/Shanghai nginx:1.25`。
- 【追问】--rm 和 -d 能一起用吗？--rm 配合 --restart 有意义吗？
  - 答：--rm 和 -d 可以一起用，容器退出时自动删除；但 --rm 和 --restart 一起用没有意义，重启策略是让容器退出后重新拉起，而 --rm 是退出就删，语义冲突，实际以 --restart 为准、--rm 被忽略。
- 【追问】--restart=always 和 unless-stopped 的区别？
  - 答：都是退出后自动重启；区别在 Docker 守护进程重启后：always 会把之前手动 stop 的容器也重新拉起，unless-stopped 尊重手动 stop 的状态不拉起。生产上我一般用 unless-stopped，避免维护时重启 docker 把不该起的容器带起来。
- 【岗位标注】通用 / 技术支持

### Q4. 镜像相关的常用命令有哪些？

- 【考察点】镜像管理命令是否熟练，是否知道 save/load 与 export/import 的区别
- 【参考回答】构建 `docker build`、打 tag `docker tag`、推送/拉取 `docker push/pull`、查看 `docker images`、删除 `docker rmi`、查看构建历史 `docker history`、导出导入 `docker save -o x.tar` / `docker load -i x.tar`。save/load 保留镜像分层和构建历史，是官方推荐的迁移方式；export/import 是导容器的文件系统，分层全丢，一般不用。另外 `docker image prune` 清理悬空镜像，`docker system df` 看磁盘占用分布。
- 【追问】离线环境怎么把镜像带进去？
  - 答：`docker save` 打成 tar 拷进去 `docker load`；更规范的是起一个私有 Harbor/registry，离线预先把镜像 push 进去，节点从内网拉。
- 【岗位标注】通用 / 运维 / 技术支持

### Q5. 容器的生命周期命令有哪些？docker stop 和 docker kill 有什么区别？

- 【考察点】生命周期管理细节，是否知道 stop 是"先 SIGTERM 后 SIGKILL"
- 【参考回答】创建 `create`、启动 `start`、停止 `stop`、重启 `restart`、暂停 `pause/unpause`、强杀 `kill`、删除 `rm`、进容器 `exec`、看日志 `logs`、看资源 `stats`、看进程 `top`、看配置 `inspect`。核心区别：`docker stop` 先发 SIGTERM 给主进程，默认等 10 秒（可用 `-t` 改），超时才发 SIGKILL；`docker kill` 默认直接 SIGKILL（可以 `-s SIGTERM` 指定信号）。pause 是发 SIGSTOP，进程还在、资源不释放。
- 【追问】生产上服务要优雅停机，你会怎么配合？
  - 答：应用注册 shutdown hook（Java 的 `@PreDestroy`/Spring graceful shutdown），入口脚本用 `exec` 让主进程成为 PID1 接收信号；把 `STOPSIGNAL` 设成应用真正监听的信号，必要时 `docker stop -t 30` 放宽超时。上线前用 `docker kill -s SIGTERM <id>` 实测一遍。
- 【岗位标注】通用 / 运维

### Q6. docker exec 和 docker attach 有什么区别？

- 【考察点】是否踩过 attach 的坑
- 【参考回答】attach 是连接到容器主进程的 stdin/stdout/stderr，相当于把自己接到主进程终端上，按 Ctrl+C 会给主进程发 SIGINT，可能把容器带崩；exec 是在容器里新起一个进程。所以日常调试我只用 `docker exec -it <容器> sh`（容器里没有 bash 就用 sh），不会用 attach。批量操作脚本里常用 `docker exec <id> cmd` 非交互执行。
- 【追问】容器里连 sh 都没有怎么办？
  - 答：`docker cp` 拷一个静态 busybox 进去，或者看是不是 distroless 镜像（本来就无 shell，设计如此），这种情况就靠 logs 和外部观测，不要硬进。
- 【岗位标注】通用 / 技术支持

### Q7. 如何查看容器的状态、资源占用和进程？

- 【考察点】排障基本功：ps/stats/top/inspect/logs 各看什么
- 【参考回答】`docker ps -a` 看状态（Up/Exited/restarting）、退出码和启动时间；`docker stats` 实时看 CPU/内存/网络，能直接发现谁在吃资源；`docker top <id>` 看容器内进程；`docker inspect <id>` 看完整配置，我用 `--format` 提取字段，比如 `docker inspect -f '{{.State.ExitCode}} {{.State.OOMKilled}}' <id>`；`docker port <id>` 看端口映射；`docker logs -f <id>` 看输出。
- 【追问】docker stats 里的内存和宿主机 free 对不上，为什么？
  - 答：stats 显示的是容器 cgroup 的 usage，里面包含了页缓存 page cache；看真实进程占用要 `docker top` 后按 RSS 算，或者看 cgroup 的 memory.stat。这也是排查"容器显示内存 1G 但实际没那么多"的关键。
- 【岗位标注】运维 / 技术支持

### Q8. 数据卷（volume）和 bind mount 有什么区别？怎么选？

- 【考察点】持久化方案是否清楚，是否踩过权限坑
- 【参考回答】volume 是 Docker 管理的目录，存在 `/var/lib/docker/volumes/<名字>/_data`，用 `docker volume create` 或 compose 里声明；bind mount 直接映射宿主机路径：`-v /opt/data:/app/data`。volume 更"docker 原生"：权限自动处理、跨容器共享方便、备份迁移用 `docker run --volumes-from` 或直接拷 _data；bind mount 适合挂配置文件（nginx.conf）、开发热更新代码，但权限完全看宿主机文件，容器里是 root 或非 root 用户时容易遇到 Permission denied。生产持久化数据我优先用命名 volume，配置文件用 bind mount 只读挂载。
- 【追问】容器删了，数据还在吗？
  - 答：命名 volume 和 bind mount 都在，容器删除不影响；但匿名卷（`-v /data` 不写名字）在 `docker rm -v` 时会被删，不带 -v 删容器会留下悬空卷。所以重要数据必须用命名卷或 bind mount，并且做备份，这是生产教训。
- 【岗位标注】通用 / 运维

### Q9. Dockerfile 常用指令有哪些？COPY 和 ADD、CMD 和 ENTRYPOINT 有什么区别？

- 【考察点】Dockerfile 基本功，两个最常问的对比
- 【参考回答】常用：`FROM` 基础镜像、`RUN` 执行构建命令、`COPY/ADD` 复制文件、`CMD/ENTRYPOINT` 定义启动命令、`ENV/ARG` 变量、`WORKDIR` 工作目录、`EXPOSE` 声明端口、`USER` 指定运行用户、`HEALTHCHECK` 健康检查、`VOLUME` 声明卷。COPY 只做纯复制；ADD 多了解压 tar 包和拉远程 URL 两个能力，但行为隐式、不推荐，一律用 COPY。CMD 是默认启动命令，能被 `docker run` 后面的参数覆盖；ENTRYPOINT 是固定入口，覆盖不了。最佳实践：`ENTRYPOINT ["nginx"]` + `CMD ["-g","daemon off;"]` 组合，两者都写成 exec 形式（JSON 数组），不要写 shell 形式，否则信号转发会有问题。
- 【追问】为什么建议 exec 形式而不是 shell 形式？
  - 答：shell 形式实际执行的是 `/bin/sh -c "命令"`，sh 成为 PID1，SIGTERM 发给 sh 它不一定转发给子进程，导致优雅停机失效、僵尸进程堆积；exec 形式直接 exec 目标程序，信号直达。这正好对应生产里"docker stop 杀不掉进程"的常见根因。
- 【岗位标注】通用 / DevOps

### Q10. 端口映射怎么做？-p 和 -P 的区别？

- 【考察点】网络基础，是否知道 EXPOSE 只是声明
- 【参考回答】`-p 8080:80` 把宿主机 8080 映射到容器 80，`-p 127.0.0.1:8080:80` 限制只监听本机回环，`-P` 把所有 EXPOSE 的端口随机映射到宿主机高位端口（`docker port` 可查）。注意 EXPOSE 只是文档性声明，不映射任何端口，真正生效的是 -p 和 dockerd 维护的 iptables DNAT 规则。host 网络模式没有映射概念，直接用宿主机端口。
- 【追问】端口冲突报 bind: address already in use 怎么排查？
  - 答：`ss -lntp` 看宿主机端口被谁占用，`docker ps` 看现有映射，换端口或停掉占用进程；容器内进程监听问题用 `docker exec <id> ss -lntp`（容器里没有 ss 就用 netstat 或 /proc）。
- 【岗位标注】通用 / 技术支持

### Q11. 容器环境变量怎么传？ENV 和 ARG 的区别？

- 【考察点】构建期/运行期变量体系是否清楚，是否有安全意识
- 【参考回答】运行时用 `-e KEY=VALUE` 或 `--env-file .env` 传入，`docker inspect` 里能看到，compose 里用 `environment:` 或 `env_file:`。Dockerfile 里 ENV 是运行期环境变量（会被 -e 覆盖），ARG 是构建期参数（`--build-arg` 传入）。关键安全点：ENV 会留在镜像历史里，`docker history` 一查就能看到明文密码，所以密码这类敏感信息我从不写进 Dockerfile，用运行时注入或 secret（BuildKit 的 `--mount=type=secret`）。
- 【追问】Compose 里 .env 和 env_file 有什么区别？
  - 答：`.env` 是给 compose 文件本身做变量替换用的（`${VAR}`），`env_file:` 是把文件内容注入容器环境变量；两者用途不同，别混。
- 【岗位标注】通用 / DevOps

### Q12. docker build 的流程是什么？.dockerignore 有什么用？

- 【考察点】构建原理是否理解，是否知道"上下文"概念
- 【参考回答】`docker build -t name:tag .` 时，docker 会把 . 目录作为构建上下文发给守护进程（传统模式），然后按 Dockerfile 逐条指令执行，每条指令产出一个镜像层；指令和上下文文件没变就命中缓存复用。`.dockerignore` 排除 `node_modules`、`.git`、`*.log`、`target/` 这类目录，作用有三：上下文变小、构建更快、避免缓存被无关文件破坏，还能防止把密钥文件打进镜像。
- 【追问】为什么我只改了一行代码，前面好多步骤都重新跑了？
  - 答：因为缓存 key 是"指令本身 + 上游层 + 该指令 COPY 的文件变化"。比如你先 `COPY . .` 再 `RUN make`，那 COPY 这一层因为整个目录内容变了就失效，后面全失效。所以 Dockerfile 的经典顺序是：先 COPY 依赖清单（requirements.txt/package.json）装依赖，最后再 COPY 业务代码。
- 【岗位标注】DevOps / 运维

---

## 三、进阶篇（12 题）

### Q1. 镜像分层和联合文件系统（overlay2）的原理是什么？

- 【考察点】是否真懂"分层"，而不是只背概念
- 【参考回答】镜像由若干只读层叠加，每层对应 Dockerfile 一条指令产生的变更；overlay2 把镜像各层作为 lowerdir，容器可写层是 upperdir，叠加出一个 merged 视图给容器看。读文件时如果 lower 有就直接读；第一次写某个文件会触发 copy-up，把文件从 lower 层拷到 upper 层再改（写时复制），所以"改一个文件"实际是"复制+改"，对小文件没感觉，对超大文件是性能陷阱。删除 lower 层的文件时会在 upper 层打 whiteout 标记。分层让多个镜像共享底层（比如都基于同一个 base），磁盘占用小、pull 只拉差量。
- 【追问】overlay2 目录在哪？怎么确认当前用的存储驱动？
  - 答：在 `/var/lib/docker/overlay2/`，`docker info | grep "Storage Driver"` 查看，也可以 `docker inspect <id>` 看 `GraphDriver` 字段的 lowerdir/upperdir/merged 路径。存储驱动选型依赖内核支持，主流发行版默认 overlay2，老的 aufs 已经很少见了。
- 【追问】写超大文件时 copy-up 性能很差，生产怎么规避？
  - 答：把大数据放在卷里而不是打进镜像层；写操作多的目录（日志、缓存）挂 volume 或 tmpfs，避免反复 copy-up。
- 【岗位标注】运维 / DevOps

### Q2. Dockerfile 的最佳实践有哪些？

- 【考察点】生产级 Dockerfile 素养：体积、缓存、安全
- 【参考回答】我总结几条硬规则：① 基础镜像固定 tag，绝不裸用 latest；② 尽量合并 RUN（`RUN apt-get update && apt-get install -y xxx && rm -rf /var/lib/apt/lists/*`），装完就清包管理器缓存；③ COPY 顺序按"变化频率从小到大"排，依赖清单在前、业务代码最后，最大化缓存命中；④ 用多阶段构建，运行镜像里不残留编译器；⑤ 用非 root 用户（`USER`），避免容器内 root 权限过大；⑥ 一个容器一个主进程；⑦ 加 HEALTHCHECK；⑧ .dockerignore 排除无关文件。
- 【追问】有人把 apt-get update 和 install 拆成两个 RUN 想利用缓存，你怎么看？
  - 答：这个其实踩过坑——apt-get update 和 install 拆开，update 层被缓存后，如果源仓库更新了，install 可能装到过期或损坏的包（经典的 "stale apt cache" 问题）。所以必须写在一起，这也说明"合并 RUN"不只是为了省层数。
- 【追问】USER 非 root 后权限问题怎么处理？
  - 答：COPY 时用 `--chown=app:app`，挂载卷注意宿主机目录属主，不然会报 Permission denied；实在要写特定目录就在 RUN 里 mkdir 并 chown。
- 【岗位标注】DevOps / 运维

### Q3. 多阶段构建的原理和用法？

- 【考察点】是否用过、能否手写一个
- 【参考回答】核心：Dockerfile 里可以有多个 FROM，只有最后一个阶段的产物进最终镜像，前面阶段（build 阶段）用完即弃。举例 Go 项目：`FROM golang:1.21 AS build` 里 go build，然后 `FROM alpine:3.19` 里 `COPY --from=build /app/server /app/server`，最终镜像只有编译好的二进制和运行时依赖，没有 Go 工具链和源码。Java 类似：maven 阶段编译打包，运行阶段用 JRE 基础镜像只拷 jar。好处：镜像从 1GB 级降到几十 MB，且构建机上的依赖不泄露进运行环境。
- 【追问】--from 除了阶段名还能引用什么？
  - 答：能直接引用外部镜像，比如 `COPY --from=nginx:alpine /etc/nginx/nginx.conf /etc/nginx/nginx.conf`，不用先 pull 成阶段；还能用 `--from=0` 按序号引用。多阶段也常用来做"构建完拷证书/时区数据"这种小文件提取。
- 【岗位标注】DevOps / 运维

### Q4. 镜像瘦身有哪些手段？

- 【考察点】实战经验：能不能说出可落地的组合拳
- 【参考回答】按效果排序：① 多阶段构建，把编译产物单独打包（最常见，见效最大）；② 基础镜像换 alpine（约 5MB，相对 ubuntu 的 70MB+）或 distroless（无 shell，更安全）；③ 清理包管理器缓存和临时文件，合并 RUN；④ .dockerignore 别把垃圾打进去；⑤ 静态编译语言直接上 scratch。我用 `docker images` 对比各版本大小、`docker history` 看哪一层大，定位"元凶层"。要注意：alpine 是 musl libc，某些 glibc 二进制（Oracle JDK、部分原生 .so）跑不了，这种情况换 distroless 或 ubuntu 更稳。
- 【追问】--squash 为什么你不太推荐？
  - 答：--squash 把多层压成一层，能减体积但会破坏层缓存（任何变更整个镜像重建），而且它是实验特性、各版本行为不一致；我更愿意从"少产生垃圾"入手而不是事后压层。
- 【追问】大模型/AI 场景镜像特别大怎么办？
  - 答：模型权重不打包进镜像（几百 GB 不现实），通过卷或对象存储挂载；镜像里只放推理框架和代码，用多阶段把 pip 缓存、训练代码剔除；GPU 场景选带 CUDA 运行库的专用基础镜像（如 nvidia/cuda 的 runtime 版，不要 devel 版）。
- 【岗位标注】DevOps / AI 运维

### Q5. Docker 的网络模式有哪些？各自适用什么场景？

- 【考察点】网络模型是否成体系，能不能讲清 DNS 和互通
- 【参考回答】四种基础模式加一种自定义：① bridge（默认），容器接在 docker0 网桥上（默认 172.17.0.0/16），靠 iptables 做 NAT 和外网通信，容器间通过网桥互通；② host，直接用宿主机网络栈，无 NAT 无隔离，性能最好但端口冲突、没隔离，适合对性能敏感或需要绑定固定端口连本机服务的场景（如监控 agent）；③ none，只有回环，跑隔离任务用；④ container:<id>，和另一个容器共享网络栈；⑤ 自定义 bridge（`docker network create`），生产主力——它自带嵌入式 DNS，容器能用**服务名/容器名**互相访问，还能设置 `--internal` 完全隔离外网。跨主机通信单靠 docker 默认网桥不行，需要 overlay 网络或交给 K8s 的 CNI（calico/flannel）解决。
- 【追问】两个容器为什么不能用容器名互访？
  - 答：默认 bridge 网络不带 DNS 解析，容器名解析是自定义网络的特性；这是很多人踩的坑——compose 里服务名能用是因为 compose 自动建了自定义网络。
- 【追问】容器访问外网的原理？为什么有人说"别乱清 iptables"？
  - 答：出站靠 docker0 上 MASQUERADE 做 SNAT，入站端口映射靠 DOCKER 链的 DNAT；手动 `iptables -F` 清掉 FORWARD/DOCKER 链，所有容器的网络就断了，重启 dockerd 会重建。排查"容器突然没网"第一件事就是看 iptables 的 FORWARD 策略是不是被 firewall 工具改成了 DROP。
- 【岗位标注】运维 / DevOps

### Q6. 容器资源限制怎么做？--memory 和 --cpus 怎么用？

- 【考察点】cgroup 理解 + 实战参数 + OOM 排查
- 【参考回答】`--memory/-m 512m` 是硬限制，超了直接被内核 OOM Killer 杀掉（退出码 137，State.OOMKilled=true）；`--memory-swap 1g` 是"内存+swap"总量，不设的话默认是内存的 2 倍（swap 部分=1 倍内存）；`--cpus 1.5` 限制最多用 1.5 个核（对应 cgroup v2 的 cpu.max），`--cpu-shares` 是相对权重不是硬限制；`--pids-limit 100` 限制进程数防 fork 炸弹；`--ulimit nofile=65535` 调文件句柄。生产上我每个服务都设 -m 和 --cpus，防止一个服务把节点打爆。验证是否生效：容器内看 `/sys/fs/cgroup/memory.max`、`cpu.max`（cgroup v2），宿主机 `systemd-cgls` 或 `docker inspect`。
- 【追问】OOMKilled 的排查步骤？
  - 答：① `docker inspect -f '{{.State.OOMKilled}}' <id>` 确认；② 宿主机 `dmesg | grep -i oom` 看谁被杀了；③ `docker stats` 看峰值内存，跟 -m 对比；④ 调整：加内存、优化应用内存（JVM 的 -Xmx 要小于容器 -m，这是经典坑）、或加 swap。特别提醒：JVM 容器里 -Xmx 设得比容器内存还大会被 OOM 杀，要留出堆外内存余量。
- 【岗位标注】运维 / AI 运维

### Q7. 命名空间和 cgroup 分别解决什么问题？

- 【考察点】底层原理，判断是"会用"还是"懂"
- 【参考回答】一句话：命名空间负责"看得见什么"（隔离），cgroup 负责"能用多少"（限制）。命名空间有：PID（进程表隔离，容器里 ps 只看到自己）、NET（独立网络栈）、MNT（挂载点视图）、UTS（hostname）、IPC（信号量/消息队列）、USER（UID 映射，容器内 root 映射到宿主机非 root）、CGROUP（1.10+）。cgroup 负责 CPU、内存、PID 数、IO 的资源限制和统计。容器本质 = 被命名空间隔离 + 被 cgroup 限制的一组进程，所以它比 VM 轻。
- 【追问】容器里 ps 为什么只能看到自己的进程？
  - 答：PID 命名空间隔离了进程表；如果想看宿主全部进程或做进程级监控，可以 `--pid=host`（要特权）或挂载 /proc。
- 【追问】USER namespace 有什么用？为什么 K8s 默认不开？
  - 答：它能把容器内 root 映射成宿主机普通 UID，即使容器逃逸也不是真 root，能显著降风险；但很多能力（挂载、设备、部分卷驱动）在 USER ns 下不兼容，所以 K8s 默认关闭，属于"知道但默认不开"的权衡点。
- 【岗位标注】运维

### Q8. HEALTHCHECK 怎么用？健康检查失败会怎么样？

- 【考察点】是否真在生产里配置过，是否知道 start-period 的作用
- 【参考回答】两种方式：Dockerfile 里 `HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -fsS http://localhost:8080/health || exit 1`，或运行时 `docker run --health-cmd="curl -fsS http://localhost:8080/health"`。状态用 `docker inspect -f '{{.State.Health.Status}}' <id>` 看，starting/healthy/unhealthy 三态。start-period 很关键：给应用启动留缓冲，避免启动慢被误判。**注意**：健康检查失败本身不会重启容器，只是标记 unhealthy，要配合 `--restart`（restart 只在进程退出时生效，unhealthy 不会触发）或编排层（compose 的 depends_on condition、K8s 的 livenessProbe）才有动作。
- 【追问】镜像里没有 curl 怎么办？
  - 答：常见坑。可以装 curl（alpine 下 `apk add curl` 会增加体积），或用 wget，或用 Python `python -c`，或用 shell 的 `/dev/tcp` 探测；distroless 镜像就用 `CMD-SHELL` 配合 wget 或者干脆不配、交给 K8s probe。
- 【追问】K8s 的 livenessProbe 和 readinessProbe 有什么区别？
  - 答：liveness 失败=容器坏了要重启；readiness 失败=还没就绪、从 Service 摘流量但不重启。对应"探活"和"流量开关"两个意图，和 Docker HEALTHCHECK（只有一态）不完全等价。
- 【岗位标注】运维 / DevOps / AI 运维

### Q9. 容器日志存在哪？日志驱动有哪些？怎么防止日志膨胀？

- 【考察点】日志体系：存储位置、驱动、轮转，以及"docker logs 的限制"
- 【参考回答】默认驱动 json-file，日志在 `/var/lib/docker/containers/<容器ID>/<容器ID>-json.log`，**默认不轮转，会无限增长**直到撑爆磁盘。全局配置在 `/etc/docker/daemon.json`：`{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}`，改完重启 dockerd 只对新容器生效，老容器要重建。其他驱动：local（20.10+，自带压缩轮转，性能好）、journald（走系统日志）、syslog/fluentd/gelf/splunk/awslogs（转发到日志平台）。注意：`docker logs` 只对 json-file、journald、local（及 gelf）有效，fluentd/syslog 等转发型驱动下 docker logs 是空的，很多人在这踩坑。
- 【追问】生产日志方案怎么设计？
  - 答：应用只往 stdout 打结构化日志（JSON），容器侧用 local 驱动或 max-size 限制本地量，采集端 filebeat/fluentd 读 json.log 或直接接 journald 转发到 ELK/Loki，日志平台做保留策略。禁止应用在容器内写大文件日志，一是占可写层、二是采集麻烦。
- 【追问】compose 里怎么配？
  - 答：service 下加 `logging: driver: json-file, options: {max-size: "10m", max-file: "3"}`。
- 【岗位标注】运维 / AI 运维

### Q10. docker-compose 怎么编排？depends_on 能保证依赖就绪吗？

- 【考察点】编排实战：依赖控制、网络、卷、多环境
- 【参考回答】compose 文件三个顶层：services/volumes/networks。核心点：① 服务之间自动建自定义网络，服务名就是 DNS，`web` 访问 `db:3306` 不用配 IP；② `depends_on` 只保证**启动顺序**，不保证就绪——数据库容器起来了但 MySQL 还没监听，应用连不上照样崩，正确做法是配合 healthcheck：`depends_on: db: condition: service_healthy`；③ 卷用顶层 `volumes:` 声明命名卷；④ 多环境用多个文件叠加：`docker compose -f base.yml -f prod.yml up -d`，变量用 `.env` 的 `${VAR}` 替换；⑤ 常用命令 `docker compose up -d / down / ps / logs -f / exec / config`（v2 是 docker 子命令，v1 的 `docker-compose` 独立二进制已停止维护）。
- 【追问】应用侧还需要做什么？depends_on 配了就万事大吉吗？
  - 答：不行，网络抖动、重启都会导致依赖瞬时不可用，应用必须自己带重试和退避（数据库连接池配置、启动重试），healthcheck 只是把"大概率可用"提前，不能替代应用容错。
- 【追问】一个 compose 里几十个服务，怎么按环境只起一部分？
  - 答：compose profiles，给服务标 `profiles: [dev]`，`--profile dev up` 按需启动；或者拆多个 compose 文件按环境叠加。
- 【岗位标注】DevOps / 运维

### Q11. 镜像仓库怎么做私有化？Harbor 有哪些核心能力？

- 【考察点】私有化落地能力（简历里有 Harbor + 离线部署）
- 【参考回答】我主导的容器化项目里私有仓库用的 Harbor。它比裸 registry 强的点：① 项目级隔离 + RBAC，不同团队各自 project；② 镜像复制（push/pull 两种模式），多机房就近同步，离线网络环境从中心仓库拉到边缘；③ 漏洞扫描（集成 Trivy），流水线里扫出高危就拦截；④ 不可变 tag，防止生产 tag 被覆盖（踩过"线上 tag 被冲"的坑）；⑤ 垃圾回收 GC 清理被删镜像占的空间；⑥ Robot 账号给 CI 用，不暴露个人密码；⑦ Webhook 通知下游。部署：官方 install.sh 离线装（依赖镜像提前打好 tar 导入），域名走 HTTPS 自签证书，各节点配置 insecure-registries 或信任 CA。使用流程：`docker tag img harbor.local/cmdb:v1.2 && docker login harbor.local && docker push harbor.local/cmdb:v1.2`。
- 【追问】镜像仓库磁盘涨得很快怎么治理？
  - 答：`docker system df` 只能看本机；仓库侧治理三板斧：tag 保留策略（只留最近 N 个）、定期跑 GC、命名规范（dev/prod 分 project 分 tag）。CI 里顺手清理过期 tag。
- 【追问】内网 pull 慢、外网要加速怎么解？
  - 答：节点配置 `registry-mirrors`（如阿里云加速器）拉公网镜像；内网统一从 Harbor 拉，Harbor 的复制能力把公网镜像同步进内网，业务完全离线。
- 【岗位标注】DevOps / 运维

### Q12. Docker 和 Kubernetes 运行时（containerd/CRI）是什么关系？K8s 不用 Docker 了吗？

- 【考察点】"熟悉 K8S"的含金量，是否跟得上生态演进
- 【参考回答】先说结论：K8s 从 1.24 起移除了 dockershim，默认不再通过 Docker Engine 创建容器，而是通过 CRI（容器运行时接口）对接 containerd 或 CRI-O；但**镜像格式没变**（OCI 标准），现有 Docker 镜像直接就能用，不用重新构建。再讲链路：Docker 内部其实早就集成了 containerd——`docker CLI → dockerd → containerd → containerd-shim → runc`；K8s 侧是 `kubelet → CRI(containerd cri 插件) → runc`。所以 containerd 既是 Docker 的底层，也是 K8s 的直接运行时，它是 CNCF 毕业项目。工具上：`ctr` 是 containerd 原生 CLI、`crictl` 是 CRI 标准 CLI（K8s 节点排障用）、`nerdctl` 是兼容 docker 语法的 CLI。
- 【追问】节点上排查容器用 docker 命令不行吗？为什么用 crictl？
  - 答：K8s 节点没装 dockerd 的话 docker 命令根本不可用；crictl 是节点排障标准：`crictl ps/exec/logs/inspect`，`crictl info` 看运行时。如果节点是通过 cri-dockerd 兼容层跑 Docker，那 crictl 和 docker 都看得到容器，但要搞清楚你在操作哪一层。
- 【追问】那 K8s 里的容器和 Docker 容器有什么本质区别？
  - 答：底层都是 containerd+runc 起的 OCI 容器，区别在上层：K8s 有 Pod（一个 Pod 里多个容器共享网络栈和存储卷，对应 pause 沙箱容器）、有 CNI 网络插件管跨节点网络、kubelet 通过 CRI 下发生命周期指令，和 docker 单机模型完全不同。
- 【岗位标注】运维 / DevOps / AI 运维

---

## 四、生产实战·刁钻篇（10 题）

### Q1. 容器内 PID1 和僵尸进程问题是怎么回事？怎么解决？

- 【考察点】这是"熟练使用 vs 生产级"的分水岭，简历敢写精通必被问
- 【参考回答】容器里 PID1 是主进程，它有两个隐藏职责：接收信号、回收孤儿进程（reap）。很多镜像的入口是 shell 或脚本，sh 起子进程后自己等在那里，子进程死了变僵尸没人 wait 回收，僵尸越堆越多，最终 `ps` 里全是 Z 状态，进程数吃满（配合 --pids-limit 直接触发限制）。我们生产上踩过，解决方案：① 最省事 `docker run --init`（Docker 内置 tini 作为 PID1）；② Dockerfile 里 `ENTRYPOINT ["tini","--","你的程序"]`；③ 自己写入口脚本时务必 `exec 程序` 让程序直接替换 shell 成为 PID1，同时循环 wait 回收子进程。
- 【追问】怎么发现容器里有僵尸？
  - 答：`docker exec <id> ps -ef | awk '$3==1 && $8~/Z/ {print}'` 看状态为 Z 的进程；或者 `docker exec <id> top -b -n1 | grep zombie`。发现后不要幻想 kill 僵尸（杀不掉，它已经死了），要解决的是父进程的回收逻辑。
- 【追问】tini 的原理是什么？
  - 答：tini 作为 PID1，主进程是它的子进程，它负责转发信号给主进程、并 wait 回收所有孤儿，主进程退出后它也退出，容器正常结束。
- 【岗位标注】运维 / DevOps

### Q2. 容器时区问题：为什么容器日志时间比北京时间差 8 小时？

- 【考察点】高频生产坑，几乎每个容器化项目都遇到
- 【参考回答】因为容器镜像默认 UTC（很多基础镜像没装 tzdata），而业务在北京时间。排查链路：`date` 看容器内时间 → 确认 UTC → 修。修复三板斧：① 运行时注入 `-e TZ=Asia/Shanghai`（镜像要装 tzdata，alpine 需 `apk add tzdata`，Debian 系自带大部分情况生效）；② 挂载 `-v /etc/localtime:/etc/localtime:ro` 和 `/etc/timezone`；③ 最好在 Dockerfile 里固化。特别坑的是 Java：JVM 在启动时缓存默认时区，只改系统 TZ 不重启 JVM 不生效，要显式 `-Duser.timezone=Asia/Shanghai`；还有 Python 的某些日志库在 import 时缓存。教训：时区必须作为"镜像/编排模板的标准项"固化，而不是每台机器手动改。
- 【追问】线上已经跑着的容器怎么快速修？
  - 答：`docker exec` 里改文件不持久，容器一重启就还原；正确做法是改 compose/镜像配置重新部署。临时救火可以用 `-e TZ` 起新容器替换。
- 【岗位标注】运维 / AI 运维 / 技术支持

### Q3. 容器里 /dev/shm 太小导致应用报错，怎么处理？

- 【考察点】AI 运维/数据库场景的实战坑，简历里有 LLM 项目，大概率被问
- 【参考回答】Docker 默认给容器 /dev/shm 只有 **64MB**，这是经典的"看着内存够却报错"的坑。典型症状：PostgreSQL 的并行查询/会话内存、MySQL 临时表、Python multiprocessing 共享内存、PyTorch DataLoader 多进程 num_workers>0 时疯狂报 "No space left on device" 或直接 OOM。解决：`docker run --shm-size=1g` 或 compose 里 `shm_size: 1g`；K8s 里用 `emptyDir: medium: Memory` 挂到 /dev/shm。定位方法：容器内 `df -h /dev/shm` 一看是 64M 基本就实锤了。
- 【追问】为什么明明宿主内存充足，还报 No space left on device？
  - 答：/dev/shm 是 tmpfs，容量上限就是挂载时定的大小，跟宿主剩余内存无关；超出就报磁盘满。这也是"内存限制没超、shm 却爆了"的迷惑性所在。
- 【追问】AI 推理服务一般设多大？
  - 答：看并发和数据加载方式：DataLoader 多进程建议 2G 起步；PG 实例按 work_mem×连接数估；宁可给大（tmpfs 按需占内存）也别抠。
- 【岗位标注】AI 运维 / 运维

### Q4. 节点磁盘被容器日志打满，怎么快速止血和根治？

- 【考察点】日志膨胀的完整处置流程（简历 100% 容器化改造必然涉及）
- 【参考回答】处置分三步：**止血**：`df -h` 找到打满的挂载点，`du -sh /var/lib/docker/containers/*/*-json.log | sort -rh | head` 揪出大头，`truncate -s 0 <该日志文件>`（truncate 比 rm 安全，dockerd 还握着 fd，rm 后空间不释放）；如果连 docker 命令都跑不动，就直接 `truncate`。**排查**：`docker logs --tail 100 <id>` 看是不是死循环刷日志，应用层先停掉或限流。**根治**：daemon.json 全局配 `log-driver: json-file` + `log-opts: {max-size: "10m", max-file: "3"}`，重启 dockerd；存量容器重建一次让配置生效；然后上日志采集（filebeat/fluentd → ES/Loki），本地只留小份。我还会把 `journald` 的 SystemMaxUse 一起限了，防止系统日志同样打满。
- 【追问】docker logs --tail 能解决吗？
  - 答：不能，--tail 只是不显示旧日志，json 文件还在继续涨；必须靠 max-size/max-file 轮转或外部采集。--log-opt 的 max-file=3 是"轮转保留 3 份 10M"，总共 30M 封顶。
- 【追问】为什么 rm 日志文件不释放空间？
  - 答：因为 dockerd 仍持有该文件的写 fd，删除后 inode 还在被写，直到容器停止/重启才释放；所以线上用 truncate 而不是 rm。
- 【岗位标注】运维 / AI 运维

### Q5. docker stop 杀不掉进程/服务不优雅退出，怎么排查和解决？

- 【考察点】优雅停机：信号、PID1、shutdown hook 的完整链路
- 【参考回答】反直觉点：`docker stop` 发 SIGTERM 后等 10 秒，超时 SIGKILL——如果你看到容器退出码 137，说明它根本没在 10 秒内处理 SIGTERM。常见原因：① 主进程是 shell（PID1=sh），sh 不转发信号给子进程，应用没收到；② 应用忽略了 SIGTERM 或没注册 shutdown hook；③ 主进程在处理但 10 秒不够（大量连接要排空）。解决链：入口脚本用 `exec`、或用 `--init`/tini、`STOPSIGNAL` 设成应用真正监听的信号（比如 Java 监听 SIGTERM 就不用改，但像 nginx 默认 SIGQUIT 才优雅退出，`STOPSIGNAL SIGQUIT`）、`docker stop -t 30` 放宽超时。验证：`docker kill -s SIGTERM <id>` 后看应用日志有没有优雅退出日志，再 `docker stop` 看退出码是否 0。
- 【追问】优雅停机时如何做到流量不中断？
  - 答：单容器做不到，要编排层：K8s 的 preStop hook + terminationGracePeriodSeconds + readiness 摘流量（先摘流量、再排空存量连接、最后 SIGTERM）；compose 场景配合负载均衡的健康检查摘除后端。
- 【追问】退出码 143 和 137 分别说明什么？
  - 答：143 = 128+15，收到 SIGTERM 后退出（说明信号到了）；137 = 128+9，被 SIGKILL（可能是 stop 超时强杀，也可能是 OOMKilled，要用 `docker inspect` 的 OOMKilled 字段区分）。
- 【岗位标注】运维 / DevOps

### Q6. /var/lib/docker/overlay2 占满磁盘，怎么排查和清理？

- 【考察点】磁盘治理：镜像层 vs 构建缓存 vs 悬空镜像的区分
- 【参考回答】先 `docker system df` 看三类占用：Images（镜像层）、Build Cache（构建缓存，经常是隐形大头）、Containers（容器可写层+日志）。再 `du -sh /var/lib/docker/*` 定位。清理手段分阶梯：`docker image prune` 清悬空镜像、`docker builder prune -f` 清构建缓存（BuildKit 缓存有时候几十 GB）、`docker system prune -a` 清所有未使用镜像（**慎用**，会连带删掉不再被引用的历史镜像，需要确认回滚依赖）、删除长期不用的容器 `docker container prune`。**千万不要**直接 `rm -rf /var/lib/docker/overlay2/*`：会破坏 dockerd 的元数据和层引用，容器全部起不来，只能重置 /var/lib/docker（数据全丢）。
- 【追问】构建缓存为什么这么大？CI 里怎么控制？
  - 答：每次构建变体都留缓存层；CI 里加定时 `docker builder prune`（保留最近 N 小时），或 GitLab Runner 的清理脚本；镜像 tag 只留 N 个版本，避免镜像仓库和节点双重膨胀。
- 【追问】怎么精确找到"哪个镜像最大"？
  - 答：`docker images --format '{{.Repository}}:{{.Tag}} {{.Size}}'` 按大小排序，`docker history <镜像>` 看每层大小，配合 `docker image prune -f` 前先 `docker system df -v` 看明细。
- 【岗位标注】运维

### Q7. 你说"100% 服务容器化"——数据库、有状态服务、定时任务也容器化了吗？怎么保证数据不丢？

- 【考察点】针对简历"100% 服务容器化"的必杀深挖，回答必须自圆其说（这是全场最可能翻车的点）
- 【参考回答】我们改造时明确了"100% 容器化"的边界：**无状态业务服务（应用、网关、worker）全部容器化**，有状态组件（MySQL、Redis、CMDB 的附件存储）走"容器化 + 外部持久化"方案，不是裸容器跑在本地盘上。具体：MySQL/Redis 用 StatefulSet 部署，数据盘挂 Longhorn 分布式存储（3 副本），通过 StorageClass 动态创建 PVC，节点挂了 Pod 漂移、数据不丢；Redis 做持久化（AOF）也落在 PV 上。定时任务不用容器内 crond（多副本会重复执行），改成 K8s CronJob，由调度器保证单实例。配置不走 IP（容器重建 IP 会变），全部走 ConfigMap/Service 名。真正没有"硬容器化"的：依赖宿主机内核模块的采集 Agent、GPU 驱动版本不匹配的推理卡（这两类用宿主机进程或特权 DaemonSet 托管）——所以准确说法是"**业务服务 100% 容器化，基础设施类按需宿主机化**"，这也是运维选型该有的克制。
- 【追问】容器化改造中你觉得最难的点是什么？
  - 答：三个：① 日志和排障习惯转变（原来 ssh 上机器看文件，现在全靠 stdout 日志+集中采集，排障链路要先搭好）；② 有状态服务的网络身份（IP 漂移），所有依赖方必须从"配 IP"改成"配服务名/DNS"，这个存量配置改造量最大；③ 无外网离线部署（我们要求离线），依赖包、镜像、Helm 包全量本地化，任何漏一个组件现场就卡住，所以离线方案要反复全流程演练。
- 【追问】数据备份怎么做？容器挂了恢复要多长时间？
  - 答：PV 层的快照（Longhorn 快照/备份到对象存储）+ 数据库逻辑备份（mysqldump 定时）双保险；恢复演练按 RTO 目标做，文档化恢复步骤，不能只备份不演练。
- 【岗位标注】运维 / DevOps

### Q8. 生产故障：容器突然访问不了外网/服务间不通，怎么排查？

- 【考察点】网络排障实战：分层定位，能不能动手
- 【参考回答】按层定位：① 先看是不是**单容器**问题：`docker exec <id> ping <网关>`（容器内可能没 ping，用 `getent hosts` 或直接看应用报错）；② 看**宿主网络**：`docker exec <id> ip addr` 看 eth0 是否有 IP、`docker network inspect` 看容器是否还挂在网上；③ 查 **iptables**：`iptables -L FORWARD -n` 看策略是不是被改成 DROP（常见元凶：firewalld 重启、安全加固脚本、别的工具清了规则），`iptables -t nat -L POSTROUTING -n` 看 MASQUERADE；Docker 的网络全靠自己维护的 iptables 链，被清基本就全网故障；④ 跨主机/K8s 场景查 CNI（calico/flannel）和 kube-proxy 状态。修复：规则被清就重启 dockerd 重建（先评估影响），或补上对应规则；K8s 场景重启 CNI DaemonSet。
- 【追问】容器内 DNS 解析失败怎么查？
  - 答：自定义网络里 Docker 注入 127.0.0.11 内嵌 DNS，`docker exec <id> cat /etc/resolv.conf` 看是否被覆写；`getent hosts <域名>` 测解析；宿主 `/etc/resolv.conf` 或 systemd-resolved 挂了也会传导；K8s 里查 CoreDNS Pod 是否正常。
- 【追问】两个容器互访时通时不通？
  - 答：大概率是依赖了宿主 IP 或容器 IP（重建后漂移）而不是服务名；再就是跨节点时默认 bridge 不支持跨主机，要用自定义网络+overlay 或 K8s CNI。
- 【岗位标注】运维

### Q9. 容器一直在重启（restarting），退出码怎么解读？怎么定位？

- 【考察点】故障定位流程 + 退出码速查，几乎必考
- 【参考回答】先看退出码：137 = 128+9（SIGKILL：OOM 被杀或 stop 强杀）、143 = 128+15（SIGTERM：收到终止信号）、139 = 128+11（段错误，多半是程序 bug 或 glibc 不兼容，alpine 上跑 glibc 二进制常见）、1 = 应用自身异常退出（看应用日志）、126/127 = 命令不可执行/不存在（Dockerfile CMD 路径写错或没有执行权限）、125 = docker run 阶段错误（如挂载参数错）。定位流程：`docker inspect -f '{{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Error}}' <id>` → `dmesg | grep -i oom|segfault` → `docker logs --tail 200 <id>` → `docker events` 看事件流。排查时先 `docker stop` 停下来，别让 restart 策略无限拉起掩盖现场（会丢日志、反复打爆节点）。
- 【追问】137 一定是内存超限吗？
  - 答：不一定。137 只代表收到 SIGKILL，可能是 OOMKilled（查 OOMKilled 字段+dmesg），也可能是平台/运维手动 kill 或 cgroup 之外被杀；要结合 OOMKilled 字段和 dmesg 综合判断，这是常见误判点。
- 【追问】配置了 --restart=always，应用每次秒退，怎么处理？
  - 答：先 `docker stop`，改配置或修复后再启动；临时调试用 `--restart=no`；生产上给 restart 加 backoff 场景由 K8s 的 CrashLoopBackOff 天然处理（会退避），单机 docker 要靠人及时介入。
- 【岗位标注】运维 / AI 运维 / 技术支持

### Q10. 容器重建后端口冲突/数据"丢了"，分别怎么处理？

- 【考察点】两个高频事故：端口占用和持久化失守，考察"踩坑后如何系统化规避"
- 【参考回答】端口冲突：`-p` 时报 `bind: address already in use`，`ss -lntp | grep <端口>` 找占用进程，可能是宿主进程或别的容器；处理是换端口或停占用方。数据丢失：十有八九是用了匿名卷或没挂卷——`docker rm` 不带 `-v` 匿名卷会残留（找不到名字），带了 `-v` 直接删数据，bind mount 路径写错导致数据写进容器可写层，容器一删就没了。系统化规避：① 所有持久化目录强制命名卷或 bind mount，compose 里顶层 volumes 声明，禁止裸 `-v /data`；② 重建/升级前先 `docker cp` 或备份卷（`tar` 打包 _data）；③ `docker rm -v` 只在确认不需要数据时用；④ 数据库类永远走 PV 或外部实例，不要把数据当容器的一部分。
- 【追问】容器重建后 IP 变了，依赖方全连不上了怎么办？
  - 答：这就是"不要依赖容器 IP"的教训：单机用 docker 网络的服务名/自定义网络，compose 自动处理；K8s 用 Service 的 ClusterIP/DNS。改造存量系统时这是最大的迁移工作量，我们在容器化项目里专门做了一轮"IP 改服务名"的配置清理。
- 【追问】bind mount 挂载目录后容器内看不到文件/权限不对？
  - 答：先确认宿主机路径存在（目录不存在 docker 会帮你建，属主是 root）；再看 UID：容器内进程是普通用户时，宿主机目录属主要 chown 成对应 UID 或给 777（生产给最小权限 755/目录属主调整）；SELinux 开启的系统还要加 `:Z` 或 `:z` 标记。
- 【岗位标注】运维 / 技术支持

---
