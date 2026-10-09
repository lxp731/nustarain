---
title: Kubernetes 面试问答·刁钻篇（16 题）
date: 2026-10-09 08:40:00
categories: 技术
tags:
  - K8S
  - 面试

---

本文是《Kubernetes 面试问答》系列的刁钻篇（生产实战），共 16 题：Pod Pending / CrashLoopBackOff / ImagePullBackOff 排查、节点 NotReady 与证书、滚动更新卡住、两个控制器抢 Pod、DNS 与 CoreDNS 打满止血、etcd 数据恢复、Longhorn drain 卡住、RKE2 升级回退、控制面高可用深挖、默认权限与切换用户、多角色 RBAC 实例、反直觉故障合集，全部是生产上真会遇到的问题。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

> 系列导航：{% post_link 技术/kubernetes-interview-basic 基础篇（20题） %} / {% post_link 技术/kubernetes-interview-advanced 进阶篇（24题） %}

---

### Q1. 线上一个 Pod 一直 Pending，你怎么排查？说完整流程。

- 【考察点】排障流程是否成体系，是不是真上手排过，通用必考。
- 【参考回答】流程是固定的：先 `kubectl get pod -n <ns>` 确认状态，再 `kubectl describe pod <name> -n <ns>`，Events 里会直接给出结论，最常见三类：`0/N nodes available`（调度失败，往下看每行被拒原因：Insufficient cpu/memory、Untolerated taint、node(s) didn't match nodeSelector）；`FailedScheduling` 还可能因为 PVC 没绑定（提示 waiting for a volume to be created）；还有 NodeAffinity 不满足。如果 describe 看不出来，就看 `kubectl get events -n <ns> --sort-by=.lastTimestamp` 补全时间线。定位到原因后按类处理：资源不足就扩容节点或降 requests；污点就加 toleration 或清污点；PVC 没绑定就去查 StorageClass 和 Longhorn 卷状态。注意 Pending 阶段 Pod 还没起来，看 logs 没用，这是很多人走弯路的地方。
- 【追问】
  - Q：Events 里说 Insufficient memory 但节点 top 显示内存很空？A：调度看的是 allocatable 减去已分配 requests，不是实时占用——很可能是其他 Pod 的 requests 写大了把节点"占满"了，`kubectl describe node` 看 Allocated resources 那一段。
  - Q：节点有污点没 toleration，具体怎么验证？A：describe node 看 Taints 字段，再看 Pod spec 有没有 tolerations；`kubectl get node -o wide` 看节点状态。
- 【岗位标注】通用 / 运维 / 技术支持

### Q2. 线上 Pod CrashLoopBackOff，怎么定位？

- 【考察点】最经典生产故障，必须要能说出完整排查链和常见根因。
- 【参考回答】CrashLoopBackOff 是容器反复启动即崩，kubelet 指数退避重启。第一步 `kubectl logs <pod> -n <ns> --previous` 看上一次崩溃的日志（当前容器日志可能被循环覆盖），很多应用报错就在这；第二步 `kubectl describe pod` 看 Last State 的 exit code 和 reason——exit code 137/143 是 OOM 或被杀，exit code 1/2 是应用自身异常退出，OOMKilled 就是内存超了 limits；第三步 `kubectl get events` 看是否有探针失败。常见根因：应用缺环境变量或配置（ConfigMap/Secret 没挂对）、启动参数错、探针路径不对导致被杀、内存超限被 cgroup OOM 杀。命令上 `kubectl logs --tail=200 -f` 盯实时，必要时 `kubectl exec` 进去手动跑启动命令复现。
- 【追问】
  - Q：怎么区分是探针杀的还是应用自己崩的？A：describe 里 Last State 的 reason 是 OOMKilled/Error 就是应用崩，Events 里 Liveness probe failed 就是探针误杀，两者修的完全不一样。
  - Q：退避重启越来越慢正常吗？A：正常，kubelet 从 10 秒起指数退避，上限 5 分钟；但如果是永久性错误要尽快修而不是等它重试。
- 【岗位标注】通用 / 运维 / 技术支持

### Q3. Pod 报 ImagePullBackOff 拉不到镜像，怎么查？如果仓库是私有 CA 证书的 Harbor 呢？

- 【考察点】贴合简历"离线部署 + Harbor"，这道题直接考真实踩坑经验。
- 【参考回答】ImagePullBackOff 的根因都在"拉镜像"这一步：先 `kubectl describe pod` 看 Events 里的具体报错，三类最常见：镜像名/tag 写错（ErrImagePull 提示 not found）、私有仓库认证失败（unauthorized/denied，需要给 Pod 配 imagePullSecrets 指向 dockerconfigjson 类型的 Secret）、证书不被信任（x509: certificate signed by unknown authority）。离线环境最常见的就是第三种：Harbor 用的自签/私有 CA 证书，K3s 默认只信任安全仓库，containerd 直接拒绝。K3s 的解法是写 /etc/rancher/k3s/registries.yaml 配 mirrors 和 configs，把 Harbor 地址的 CA 证书配进去，然后 `systemctl restart k3s`；我踩过的坑是 `ctr images pull` 单独测时会报 tls verify 失败，但配好 registries.yaml 后 containerd 走的是配置里的 CA 就正常了。验证镜像能不能拉：`kubectl exec` 别的 Pod 里 `docker pull`/`crictl pull`，或者直接看 containerd 日志。
- 【追问】
  - Q：镜像拉取超时/断流怎么排查？A：看是哪个节点在拉（describe 会写 node），节点到 Harbor 的网络、Harbor 磁盘和存储空间（镜像仓库满了会报 no space）、大镜像拉取超时调低超时或分块。
  - Q：imagePullSecrets 怎么建？A：`kubectl create secret docker-registry regcred --docker-server=harbor.xxx --docker-username=xxx --docker-password=xxx`，再在 Pod 的 spec.imagePullSecrets 引用。
- 【岗位标注】运维 / 技术支持

### Q4. 节点突然 NotReady，你怎么恢复？kubelet 证书过期呢？

- 【考察点】节点故障是运维日常，NotReady 的原因排查是硬功夫。
- 【参考回答】先 `kubectl get nodes` 确认哪些节点 NotReady，然后 SSH 到节点上看：第一步 `systemctl status rke2-agent`（或 kubelet）看服务状态，第二步 `journalctl -u rke2-agent -f` 看最近日志，第三步 `df -h` 看 /var/lib/rancher/rke2 磁盘是不是满了（磁盘满会导致 kubelet 无法写状态，非常常见），第四步查网络（节点到 apiserver 的 6443 通不通）。证书过期是经典原因：kubelet 的客户端证书默认一年，RKE2 会自动轮转，但手动部署或证书被误删时会过期，报错类似 "x509: certificate has expired or is not yet valid"，解决是确认 RKE2 自动轮转机制（RKE2/k3s 的证书由 server 端统一管理，一般重装 agent 或重启后自动续）。恢复流程：能修则修（清磁盘、重启 agent、修网络），修好后节点 Ready，NotReady 期间超过 300 秒被驱逐的 Pod 会自动在其他节点重建——如果节点上跑着单副本有状态服务，这里就是数据风险点，所以生产要有反亲和性。
- 【追问】
  - Q：NotReady 节点上的 Pod 被驱逐了，数据怎么办？A：有 PVC 的卷会保留，Pod 重建后重新挂载；无状态服务直接重建没事；所以有状态服务要保证副本在其他节点，单副本是事故。
  - Q：怎么主动避免 NotReady 的连锁反应？A：给节点打 label 分组、有状态服务配 podAntiAffinity 跨节点、磁盘和内存监控告警前置、etcd 节点单独监控。
- 【岗位标注】运维

### Q5. 滚动更新卡住了，完整排查思路是什么？

**一、先确认“卡住”这个事实**

`kubectl rollout status` 长时间不推进，典型输出是：

```text
Waiting for deployment "nginx" rollout to finish: 1 out of 3 new replicas have been updated...
```

这时别急着改配置，先按层级往下走。

**二、四步定位**

**Step 1：看 Deployment 的 Conditions**

```bash
kubectl describe deploy/nginx
```

重点看 `Progressing` 和 `Available`：

```text
Conditions:
Type           Status  Reason
----           ------  ------
Available      True    MinimumReplicasAvailable
Progressing    False   ProgressDeadlineExceeded    # ← 更新超时失败
```

如果 `Progressing` 已经是 `False`，说明已经过了 `progressDeadlineSeconds`，属于明确失败而不是“还在慢慢等”。

**Step 2：看新旧 RS 的副本分布**

```bash
kubectl get rs -l app=nginx
```

```text
NAME       DESIRED  CURRENT  READY  AGE
nginx-abc  3        3        3      1h    # 旧 RS
nginx-def  2        2        0      5m    # 新 RS，READY=0 → 问题在这里
```

这一步是关键分水岭：

- 新 RS 的 `DESIRED` 在涨但 `READY` 一直是 0 → 新 Pod 起不来或不就绪；
- 新 RS `DESIRED` 不涨、旧 RS 也没缩 → 可能是调度约束或 `maxSurge/maxUnavailable` 把更新空间卡死了；
- 旧 RS 已经在缩但新 RS 没跟上 → 说明策略配置有问题，可用副本数在往下掉。

**Step 3：看新 RS 的 Pod 状态和事件**

```bash
kubectl get pods -l app=nginx | grep nginx-def
kubectl describe pod/nginx-def-xxxxx
```

**Step 4：按现象对根因**

| 现象 | 根因 |
| --- | --- |
| Pod 一直 ContainerCreating | 镜像拉取失败（私有仓库认证）、存储挂载失败（PVC 未绑） |
| Pod Running 但 READY 0/1 | Readiness Probe 失败（最常见）——端口探测不通、健康检查路径返回非 200 |
| Pod CrashLoopBackOff | 新版本启动即崩溃（环境变量缺失、配置错误、依赖服务未就绪） |
| 新 Pod 一直 Pending | 资源不足、节点亲和性不满足 |

**三、为什么“卡住”其实不算坏事**

最典型的场景是新版本镜像有 bug，启动后 Readiness Probe 一直失败 → 新 Pod 永远不就绪 → 滚动更新永远不会继续缩容旧 RS → 服务保持旧版本可用。这其实是滚动更新的设计优点：宁可卡住也不中断。

所以排查时不要一上来就想“怎么让它过去”，先判断是 **该修** 还是 **该回滚**。

**四、几个容易漏的排查点**

**Pending 的三板斧**：先看事件 `kubectl describe pod | grep -A 20 "Events:"`，再看调度失败原因 `grep -A 10 "FailedScheduling"`，最后 `kubectl top nodes` 检查节点资源。常见原因就那么几个：节点资源不足、镜像拉取失败、调度策略不匹配、InitContainer 卡死。

**调度约束死锁**：生产里有个隐蔽组合——`nodeAffinity` 主机名写错，再叠加 required 反亲和与 `maxSurge: 0`，就会出现新 Pod 长期 Pending、READY 从 2 掉到 1 的情况。这种光看 Pod 日志是找不出来的，得回头审 affinity 配置。

**探针与就绪的时序**：`minReadySeconds` 没配的话，K8s 只要 Pod 变成 Running 就可能认为就绪并开始删旧 Pod，忽略了应用实际完成初始化、具备服务能力所需的时间。

**五、处置建议**

- 新版本确认有严重问题 → 直接 `kubectl rollout undo`，或改回旧镜像；
- 只是想先拿到新版本日志排查 → 可以临时调 `maxUnavailable`，但这会短暂中断服务，等价于 Recreate 策略，生产慎用；
- 长期方案还是把 `maxUnavailable`、`maxSurge`、`minReadySeconds` 和 ReadinessProbe 一起配合理，滚动更新只是控制 Pod 数量的机制，不是流量安全的保证，真正零停机需要 ReadinessProbe 检查完整、PDB 保护最小可用数、滚动参数保守配置三者缺一不可。

---

这套思路其实和你现在练的 K8s 生产排查挺契合的，要不要我按“现象 → 定位 → 根因 → 修复”的格式，帮你整理成一份可以放进简历项目经历的排障案例模板？

### Q6. 控制器抢 Pod 怎么快速定位是哪个控制器，怎么修复？

排查这类问题，核心思路是： **先用标签找到所有可能被选中的 Pod，再用 `ownerReferences` 确认每个 Pod 到底归谁管。**

**1. 先确认哪些 Pod 被选中**

比如你怀疑 `app=web` 这个选择器太宽：

```bash
kubectl get pods -l app=web --show-labels -n <namespace>
```

如果输出里 Pod 的标签非常杂，说明这个选择器可能命中了多个控制器。

**2. 看 Pod 到底属于哪个控制器**

挑一个“删了又出现”的 Pod：

```bash
kubectl get pod <pod-name> -n <namespace> -o yaml
```

看 `metadata.ownerReferences`：

```yaml
ownerReferences:
  - kind: ReplicaSet
    name: web-deploy-6b7d8f9c5a
    controller: true
```

这说明它归这个 ReplicaSet 管。再往上查：

```bash
kubectl get replicaset web-deploy-6b7d8f9c5a -n <namespace> -o yaml
```

看它的 `ownerReferences`，通常会出现：

```yaml
ownerReferences:
  - kind: Deployment
    name: web-deploy
    controller: true
```

这样就能确认： **这个 Pod 最终归哪个 Deployment 管。**

也可以快速看控制器类型：

```bash
kubectl get pods -l app=web -n <namespace> \
  -o custom-columns=NAME:.metadata.name,CONTROLLER:.metadata.ownerReferences[].kind
```

如果同一批 Pod 里出现多个 Deployment / ReplicaSet，基本就是选择器冲突。

**3. 看控制器期望副本数**

```bash
kubectl get deployment -n <namespace>
kubectl get replicaset -l app=web -n <namespace>
```

如果多个控制器都显示 `READY` 数量和实际 Pod 数量对不上，或者不断创建、删除，就说明它们在抢同一组 Pod。

**4. 修复方法**

**方法一：收紧选择器**

把宽泛的 `app: web` 改成更精确的组合，例如：

```yaml
selector:
  matchLabels:
    app: web
    instance: frontend-v1
```

注意： **Deployment 创建后 `spec.selector` 不能直接改。**

必须删除重建，或者用：

```bash
kubectl delete deployment <name> --cascade=orphan
```

保留现有 Pod，再用新 selector 重新创建。

**方法二：把误选的 Pod 从对方控制器里移出去**

如果某个 Pod 被错误地打了标签，可以改标签：

```bash
kubectl label pod <pod-name> app=web- --overwrite -n <namespace>
```

但更稳的做法是： **找到误配的 Deployment / ReplicaSet，直接删除或修正它。**

**方法三：如果是 ArgoCD / Flux / Helm 重建**

删完又出现，不一定只是 selector 冲突，也可能是 GitOps 工具或 Helm 在持续同步。

可以先查：

```bash
helm list -A
kubectl get app -A   # ArgoCD
```

如果资源来自 GitOps，不要只手动删，要在 Git 仓库或 Helm Release 里修正配置。

**排查顺序可以记成**

```text
kubectl get pods -l <label> --show-labels
→ kubectl get pod <pod> -o yaml 看 ownerReferences
→ kubectl get replicaset / deployment 确认控制器
→ 收紧 selector 或删除冲突控制器
→ 检查是否有 ArgoCD / Flux / Helm 持续同步
```

最关键的一点： **标签决定“谁能被选中”，ownerReferences 决定“谁真正拥有它”。** 两个控制器抢 Pod，一定是 selector 重叠；删了又出现，一定是还有控制器或 GitOps 工具在维护它。

### Q7. 两个服务之间域名解析不通/超时，怎么排查？CoreDNS 出问题呢？

- 【考察点】DNS 是微服务最常见的隐形炸弹，AI 运维（微服务互相调用）尤其爱考。
- 【参考回答】分两层：先确认 DNS 服务本身，再确认解析链路。第一层：`kubectl -n kube-system get pods -l k8s-app=kube-dns` 看 CoreDNS Pod 是否 Running，`kubectl -n kube-system logs -l k8s-app=kube-dns --tail=50` 看报错；CoreDNS 挂了表现是所有服务间域名解析都失败。第二层：在出问题的 Pod 里 `kubectl exec <pod> -- nslookup <svc名>.<ns>.svc.cluster.local`，验证解析结果；再看 Pod 的 /etc/resolv.conf，默认 `ndots:5` 意味着 `foo` 这种短名会先尝试拼接多个 search 域，每次查询有 5 秒超时，多域串行查询叠加就变成"偶尔 10-25 秒卡顿"，这是经典性能坑。我实际修过一次：CoreDNS 上游 forward 指向的 DNS 不通，导致内部解析正常但外部域名全超时，改 Corefile 的 forward 目标解决。
- 【追问】
  - Q：Service 名解析通了但访问超时，往哪查？A：往下游走：Service 有没有 endpoints → 后端 Pod 是否 Ready → Pod 内端口是否真的监听 → kube-proxy 规则；DNS 只是第一站。
  - Q：ndots:5 的坑怎么绕过？A：应用配置里用完整域名 `svc.ns.svc.cluster.local` 或服务名加 `svc` 后缀，减少 search 域尝试次数；或者在 Pod 里覆盖 dnsConfig。
- 【岗位标注】运维 / AI 运维

### Q8. 高并发下 CoreDNS 被打满，怎么排查定位？

高并发场景下 CoreDNS 被打满，排查思路可以按 **"Pod → CoreDNS → 节点网络"** 这条链走。

**1. 先看 Pod 侧：确认是不是 DNS 解析慢**

先进一个业务 Pod，看它的 DNS 配置和解析表现：

```bash
kubectl exec -it <pod> -- cat /etc/resolv.conf
kubectl exec -it <pod> -- nslookup kubernetes.default
kubectl exec -it <pod> -- nslookup www.example.com
```

重点看：

- `nameserver` 是否指向 `kube-dns` 的 ClusterIP；
- `search` 里是不是有 `svc.cluster.local`、`cluster.local`；
- `ndots` 是不是默认 5；
- 解析内部服务和外部域名是否都慢；
- 业务日志里有没有 `i/o timeout`、`no such host`、`SERVFAIL`。

如果外部域名解析明显慢，优先怀疑 **`ndots:5` 放大查询**。

**2. 看 CoreDNS 本身：状态、资源、日志**

```bash
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl top pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=200
kubectl describe pod -n kube-system <coredns-pod>
```

重点看：

- CoreDNS Pod 是否频繁重启、OOMKilled；
- CPU 是否长期接近 limit；
- 日志里有没有 `SERVFAIL`、`i/o timeout`、`plugin/loop`、`no nameservers found`；
- 是否有某个 CoreDNS Pod 明显比其他 Pod 更忙。

如果某个 Pod 特别忙，很可能是 **UDP 五元组哈希导致流量不均**，客户端复用源端口或连接池会把请求集中到同一个 CoreDNS Pod。

**3. 看指标：QPS、错误率、延迟**

如果集群有 Prometheus，可以看这些指标：

- `coredns_dns_requests_total`：总请求量；
- `coredns_dns_request_duration_seconds`：解析延迟；
- `coredns_cache_hits_total` / `coredns_cache_misses_total`：缓存命中率；
- `coredns_dns_response_rcode_total`：响应码分布，尤其是 `SERVFAIL`、`NXDOMAIN`。

如果 `NXDOMAIN` 很多，说明大量查询在拼 `search` 后缀；如果 `SERVFAIL` 多，说明 CoreDNS 自身或上游 DNS 出了问题。

**4. 看节点网络：conntrack、kube-proxy、NetworkPolicy**

如果 CoreDNS 看起来正常，但 Pod 解析偶发超时，要查节点层：

```bash
cat /proc/net/nf_conntrack | wc -l
sysctl net.netfilter.nf_conntrack_max
netstat -su
```

常见根因是 **conntrack 表接近打满**，UDP DNS 响应包被丢弃。

另外还要确认：

- kube-proxy 是否使用 IPVS；
- IPVS UDP 超时是否过长，导致 CoreDNS 重启后旧连接仍然复用；
- 业务命名空间是否有 NetworkPolicy 阻断了到 `kube-dns` 的 53/UDP、53/TCP。

**5. 常用优化手段**

| 问题 | 处理办法 |
| --- | --- |
| 外部域名解析慢 | 把 `ndots` 降到 2，或代码里用 FQDN 域名 |
| CoreDNS CPU 高 | 扩容 CoreDNS 副本，打散到不同节点 |
| 单 Pod 过载 | 调整应用 DNS 源端口复用，减少连接池长连接 |
| conntrack 打满 | 部署 NodeLocal DNSCache，减少跨节点 UDP 查询 |
| IPVS 会话保持导致超时 | 部署 NodeLocal DNSCache，或调小 IPVS UDP 超时 |
| 上游 DNS 慢 | 检查节点 `/etc/resolv.conf` 和 CoreDNS `forward` 配置 |

其中 **NodeLocal DNSCache** 是生产高并发场景里最推荐的手段之一。它会在每个节点上跑一个本地 DNS 缓存，Pod 先查本地缓存，命中就直接返回，没命中再走 CoreDNS，能明显降低 CoreDNS QPS 和 conntrack 压力。

**排查顺序可以这样记**

```text
Pod resolv.conf / ndots
  → CoreDNS Pod 状态、CPU、日志
  → Prometheus 指标：QPS、延迟、NXDOMAIN、SERVFAIL
  → 节点 conntrack、kube-proxy、NetworkPolicy
  → 优化 ndots / FQDN / CoreDNS 副本 / NodeLocal DNSCache
```

如果你愿意，可以把你集群里 `kubectl get sc`、`kubectl get pods -n kube-system -l k8s-app=kube-dns`、以及某个业务 Pod 的 `/etc/resolv.conf` 贴出来，我可以帮你判断当前更可能是哪一类问题。

**补充：UDP 五元组哈希为什么会导致 CoreDNS 流量不均？**

这个问题其实涉及两层： **kube-proxy 怎么做 UDP 负载均衡**，以及 **客户端怎么用 DNS 连接**。

**先说“UDP 五元组哈希”**

五元组就是：

```text
源 IP
源端口
目标 IP
目标端口
协议
```

比如一个 Pod 发起 DNS 查询，目标通常是 `kube-dns` 的 ClusterIP 和 53 端口，协议是 UDP。那么这条 UDP 流大概长这样：

```text
src: 10.244.1.5:42621
dst: 10.96.0.10:53
proto: UDP
```

kube-proxy 在做 Service 负载均衡时，如果是 **IPVS 模式**，它会把 `kube-dns` 这个 Service 变成一个 IPVS 虚拟服务，后端 Pod 就是 Real Server。

IPVS 对 UDP 流量做负载均衡时，常用的一种方式是按五元组哈希：同一个五元组会被哈希到同一个后端 Pod。

这本身是为了保证“同一条 UDP 流”稳定落在同一个后端上，避免来回跳。

**为什么会导致流量不均？**

问题在于： **DNS 查询是大量短 UDP 包，但五元组里能变化的空间很小。**

目标 IP、目标端口、协议基本是固定的：

```text
dst: kube-dns ClusterIP
dst port: 53
proto: UDP
```

真正能变的只有：

- 源 IP：通常就是 Pod IP；
- 源端口：每次查询理论上可以随机。

如果一个应用每次发 DNS 请求都用 **同一个源端口**，那五元组几乎完全一样。IPVS 就会把这条“流”一直打到同一个 CoreDNS Pod 上。

所以看起来是：

```text
Pod A 发 10000 次 DNS 查询
→ 源端口几乎不变
→ 五元组哈希结果几乎不变
→ 全部打到 CoreDNS-Pod-1
→ CoreDNS-Pod-2 / Pod-3 很闲
```

这就叫 **UDP 五元组哈希导致流量不均**。

**再说“客户端复用源端口 / 连接池”**

DNS 本身是 UDP，严格说没有 TCP 那种“连接池”。但很多 DNS 客户端库、应用框架会做类似的事情：

- 复用同一个 UDP socket；
- 复用同一个源端口；
- 对同一个 DNS 地址建立长连接；
- 用连接池复用解析通道；
- 并发发 A 记录和 AAAA 记录时共用 socket。

这些行为都会让“源端口”变化不足。

如果客户端每次都新建 socket、随机源端口，五元组变化更充分，IPVS 更容易把请求分散到不同 CoreDNS Pod。

但如果客户端复用 socket 或源端口，IPVS 会认为这是“同一条流”，于是继续打到同一个后端。

**一个直观对比**

| 客户端行为 | 五元组变化 | 结果 |
| --- | --- | --- |
| 每次新建 UDP socket，随机源端口 | 源端口变化大 | 请求较均匀分散到多个 CoreDNS Pod |
| 复用同一个 socket / 源端口 | 五元组几乎不变 | 请求集中到同一个 CoreDNS Pod |
| 连接池复用 DNS 通道 | 源端口长期固定 | 单个 CoreDNS Pod QPS 异常高 |

**所以它为什么危险？**

不是所有 CoreDNS Pod 都忙，而是 **某一个 CoreDNS Pod 先被打满**。

这个 Pod 可能出现：

- CPU 接近 limit；
- 响应延迟升高；
- 日志里出现 `SERVFAIL`、`i/o timeout`；
- 甚至 OOM 或 CrashLoopBackOff。

而其他 CoreDNS Pod 可能还很空闲。

**怎么验证是不是这个问题？**

可以开 CoreDNS 查询日志，看客户端来源 IP 和端口分布：

```bash
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=200
```

如果你反复看到同一个 Pod 日志里出现大量相同源 IP + 相同源端口，基本就能确认是流量不均。

**怎么处理？**

常见做法有几类：

- 应用层随机化 DNS 源端口，减少 socket 复用；
- 扩容 CoreDNS 副本，并打散到不同节点；
- 部署 **NodeLocal DNSCache**，让 Pod 先查本地缓存，大幅降低 CoreDNS QPS；
- 如果用了 IPVS，注意 UDP 会话保持超时，默认较长时 CoreDNS 重启或缩容后可能出现短暂解析异常。

一句话概括： **UDP 五元组哈希会让“同一条流”固定到同一个后端；如果客户端复用源端口或 DNS 连接，这条流就会长期打到同一个 CoreDNS Pod，造成单点过载。**

### Q9. CoreDNS 过载时怎么快速止血、先保住业务访问？

生产上遇到 CoreDNS 被打满， **不要一上来就重启 CoreDNS**，尤其是 IPVS 模式下，重启可能引发几分钟内集群范围解析异常。 更稳的止血顺序是： **先扩容打散，再降 QPS，再绕开 Service VIP，最后处理 conntrack / IPVS。**

**第一步：先扩容 CoreDNS，把单 Pod 热点打散**

如果某个 CoreDNS Pod 明显更忙，先把它从 2 个副本扩到 4、6 或更多，并且尽量打散到不同节点。

```bash
kubectl scale --replicas=6 deployment/coredns -n kube-system
```

同时确认：

- 每个 CoreDNS Pod 至少 **1 核 CPU、1G 内存**；
- 不要使用 HPA / CronHPA 自动伸缩 CoreDNS，频繁缩容会引发解析异常；
- 如果节点资源紧张，先加节点或腾资源，否则扩副本也起不来。

**第二步：快速降低 DNS 查询量**

如果业务里有大量外部域名调用，优先把 Pod 的 `ndots` 调低，或者改用 FQDN。

```yaml
dnsConfig:
  options:
    - name: ndots
      value: "2"
```

外部域名较多的服务可以降到 `1` 或 `2`。

如果改 Deployment 来不及，可以先让新发布的服务先生效，老服务逐步滚动更新。

**第三步：绕开 Service VIP，直连健康 CoreDNS Pod**

如果走 `kube-dns` Service IP 解析不稳定，可以在关键 Pod 里临时把 nameserver 指向某个健康 CoreDNS Pod 的 Pod IP。

```yaml
dnsPolicy: None
dnsConfig:
  nameservers:
    - <coredns-pod-ip>
```

这个办法适合临时止血，不适合长期用，因为 Pod IP 会变。

**第四步：检查并缓解 conntrack 和 IPVS 问题**

如果节点上出现：

```bash
nf_conntrack: table full, dropping packet
```

说明 conntrack 表可能打满，UDP DNS 响应会被丢。 可以先在节点上检查：

```bash
sysctl net.netfilter.nf_conntrack_count
sysctl net.netfilter.nf_conntrack_max
```

临时缓解可以调大 `nf_conntrack_max`，但更稳的方案是部署 **NodeLocal DNSCache**，让 Pod 先查本地缓存，减少跨节点 UDP 查询和 conntrack 压力。

如果之前刚重启过 CoreDNS，且集群用 IPVS，还要留意 UDP 会话保持默认 300 秒，可能导致短暂解析异常。 长期建议调小 IPVS UDP 超时，比如 10 秒，但这个操作影响面较大，生产上要谨慎。

**第五步：定位热点客户端，必要时限制或打散**

如果 CoreDNS 日志里反复出现同一个客户端 IP + 同一个源端口，说明是 UDP 五元组哈希导致的单 Pod 过载。

```bash
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=200
```

临时处理可以：

- 重启热点业务 Pod，让它重新分配源端口；
- 把热点业务打散到更多节点；
- 降低该服务的 DNS 查询频率，增加本地域名缓存；
- 后续推动应用随机化 DNS 源端口，减少 socket 复用。

**生产止血优先级**

| 动作 | 风险 | 止血效果 |
| --- | --- | --- |
| 扩容 CoreDNS 并打散节点 | 低 | 最快缓解单 Pod 过载 |
| 调低 ndots / 使用 FQDN | 低 | 明显降低外部域名放大查询 |
| 直连健康 CoreDNS Pod IP | 中 | 临时绕过 Service VIP 抖动 |
| 调大 conntrack_max | 中 | 缓解 UDP 丢包 |
| 部署 NodeLocal DNSCache | 低 | 中长期最有效 |
| 调小 IPVS UDP 超时 | 高 | 需谨慎，建议灰度验证 |

最推荐的组合是： **先扩 CoreDNS + 降 ndots + 部署 NodeLocal DNSCache**。 这样既能快速止血，也能避免后续再被同一类问题打满。

---

NodeLocal DNSCache 部署最复杂，要不要说说它的安装流程和 Pod 侧怎么配置才能生效？

**补充：扩容 CoreDNS 后业务复用连接，会不会又打满单个 Pod？**

你这个疑问其实很关键： **扩容 CoreDNS 并不能从根上解决“五元组哈希不均”，它只是先让那个被打满的 Pod 不那么容易挂。**

**为什么扩容还是有意义？**

假设现在有 3 个 CoreDNS Pod，其中一个因为五元组哈希集中了大量请求，CPU 已经 90% 以上。

这时候把它从 3 扩到 6，会发生两件事：

- 原来那个热点 Pod 上的请求仍然集中，但 **总容量变大了**；
- 新增的 CoreDNS Pod 会承接一部分新流，整体集群 DNS 处理能力上升。

所以它不是“彻底修复不均”，而是 **先把单点过载风险降下来**，给后面排查、调 ndots、部署 NodeLocal DNSCache 争取时间。

**但你说得对：扩容后仍然可能不均**

如果业务 Pod 仍然复用同一个源端口、同一个 UDP socket，或者 DNS 客户端做了连接池，那它发出去的 DNS 请求五元组变化仍然很小。

IPVS 做 UDP 负载均衡时，会按五元组做哈希：

```text
源 IP
源端口
目标 IP（kube-dns ClusterIP）
目标端口（53）
协议（UDP）
```

只要这几个值不变，IPVS 就会认为这是同一条流，继续打到同一个 CoreDNS Pod。

所以扩容之后， **热点可能仍然存在**，只是从“快被打死”变成“还能扛一会儿”。

**真正止血要配合这几步**

| 动作 | 作用 | 局限 |
| --- | --- | --- |
| 扩容 CoreDNS | 提升总容量，降低单 Pod 挂掉概率 | 不能彻底解决哈希不均 |
| 降低 ndots / 使用 FQDN | 减少无效 search 查询，降低 QPS | 对已形成的热点缓解有限 |
| 重启热点业务 Pod | 重新分配源端口，打散当前流 | 临时有效，应用复用 socket 后可能复现 |
| 部署 NodeLocal DNSCache | 让 Pod 先查本地缓存，大幅减少打到 CoreDNS 的请求 | 需要部署和配置 |

其中 **NodeLocal DNSCache 是更根本的办法**。它会在每个节点上跑一个本地 DNS 缓存，Pod 先把请求发给本地缓存，命中就直接返回；没命中才会转发给 CoreDNS。

这样一来，即使业务 Pod 仍然复用源端口，也不会把所有请求都砸到同一个 CoreDNS Pod 上，因为大部分查询已经被本地缓存消化了。

**可以这样理解**

- **扩容 CoreDNS**：先把“单点被打爆”的风险降下来，是临时止血。
- **降 ndots / 用 FQDN**：减少不必要的 DNS 放大查询，降低总 QPS。
- **重启热点 Pod**：让源端口重新随机化，暂时打散流量。
- **NodeLocal DNSCache**：从架构上减少 CoreDNS 压力，是更稳的解法。
- **应用随机化源端口 / 减少 DNS socket 复用**：从根上缓解五元组哈希不均。

所以你原来的判断是对的： **只扩容，确实可能很快又出现某个 CoreDNS Pod 更忙。** 但生产上先扩容，是为了避免热点 Pod 直接 OOM 或崩溃，然后再用 ndots、NodeLocal DNSCache 和应用侧调整把问题彻底收住。

### Q10. etcd 出问题/数据丢失，怎么恢复？你 3 控制节点的集群遇到过吗？

- 【考察点】简历写"3 控制节点 + Rancher 管理"，这题专门验证是否真做过高可用、真备份过。
- 【参考回答】分情况：如果只是单节点 etcd 挂了但多数派还在，集群不中断，把节点修好重新 join 就行，不需要恢复流程；如果失去多数派（3 节点挂 2 个），集群进入只读，必须用快照恢复：选一台节点，`rke2 server --cluster-reset` 配合 `--cluster-reset-restore-path=<快照>` 从快照重建，恢复后这台变成唯一 server，其余节点删掉旧 etcd 数据重新 join。关键在"平时有没有快照、快照在不在"，所以我项目里把备份做成定时任务并拷贝到集群外，而且恢复流程先在测试集群演练过——真到事故现场才第一次恢复，基本都会慌。恢复后要验证：kubectl get nodes 全 Ready、业务 Pod 恢复、Rancher 里集群 agent 重新连上（cattle-cluster-agent 偶尔要重启）。
- 【追问】
  - Q：为什么 etcd 要奇数节点？A：raft 共识需要多数派，3 节点容忍 1 个故障，4 节点也只容忍 1 个，白浪费一台，5 节点容忍 2 个。
  - Q：没有快照、etcd 全挂了怎么办？A：只能从备份介质恢复，或者认命重建集群——这就是"备份就是运维的命"的原因，所以每次面试我都会强调备份策略。
- 【岗位标注】运维

### Q11. Longhorn 节点要维护（重启/下线），drain 卡住怎么办？磁盘满了呢？

- 【考察点】简历写了 Longhorn，这题考真实存储运维经验，drain 卡住是高频踩坑点。
- 【参考回答】Longhorn 节点维护的标准流程：先在 Longhorn UI 或命令里给卷做快照确认数据安全，然后 `kubectl cordon <node>` 禁止新调度，再 `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data`。drain 卡住的经典原因是：节点上有卷还处于 attached 状态（有 StatefulSet Pod 在用），或者副本只剩一个在该节点（最后一个副本导致 Longhorn 拒绝 detach，怕数据丢）。处理：把 Pod 迁走（先看有没有别的副本，`kubectl get volumes.longhorn.io -A` 或 UI 看 Replicas），必要时先在 Longhorn 里把该节点的副本调度出去（节点设置里禁止副本调度，让系统自动重建副本到其他节点），等卷 detach 再 drain。磁盘满的问题：Longhorn 磁盘空间不足会标记节点 disk 异常，卷变成 degraded，处理是先清理快照（`kubectl -n longhorn-system delete snapshots...` 或 UI 清理）、再加盘扩容，Longhorn 支持在线添加磁盘。另外注意 Longhorn 默认副本数 3，节点数小于 3 时副本会调度失败，所以生产至少 3 个带数据盘的 worker 节点。
- 【追问】
  - Q：drain 时 --ignore-daemonsets 是干嘛的？A：DaemonSet 的 Pod 在每个节点都有，drain 删不掉，必须忽略，否则 drain 会卡死在等 DaemonSet Pod 终止。
  - Q：维护节点导致卷 degraded 怎么办？A：只要还有健康副本，卷会继续服务，系统自动在其他节点补副本，补完回到 healthy；这期间不要并发维护第二个节点，否则可能只剩一个副本。
- 【岗位标注】运维 / AI 运维

### Q12. 生产 RKE2 集群怎么升级？先升什么？怎么回退？

- 【考察点】升级是生产运维最怕的活，能答出顺序和回退说明真干过。
- 【参考回答】RKE2 升级的核心是"先 agent 后 server、控制面节点逐个来、先验证再滚动"。流程：先在测试环境升一遍；生产上先备份 etcd 快照；然后升级 worker 节点（agent），每台升级完验证节点 Ready、业务正常再下一台；再逐个升级控制节点（server），每升完一台确认 etcd 健康（`/var/lib/rancher/rke2/bin/etcdctl endpoint health`）和 apiserver 正常。RKE2 支持 channel 管理（stable/latest），离线环境就手动下载对应版本的 tar 包替换。回退策略：RKE2 官方对降级支持有限，所以升级前必须留 etcd 快照和旧版本安装包，出问题用快照恢复。升级 Rancher 同理：先备份，小版本升级，升级完看 cattle-system 的 Pod 是否全部 Running、集群 agent 是否重连。还有一条经验：升级前看 release notes 有没有破坏性变更（比如 CNI、kube-proxy 模式参数变化）。
- 【追问】
  - Q：K3s 和 RKE2 升级方式一样吗？A：大体一样（都是替换二进制 + systemctl restart），K3s 还支持 `curl -sfL https://get.k3s.io | sh -` 脚本直接升；RKE2 官方推荐用 rke2-upgrade controller 自动化。
  - Q：升级控制节点时 etcd 会怎样？A：逐个升级时每台短暂不可用，只要多数派在线集群就正常，所以绝不能同时重启两台控制节点。
- 【岗位标注】运维 / DevOps

### Q13. 深挖：你的 3 控制节点 + 5 工作节点集群，控制面前面有没有负载均衡？单点在哪？证书怎么管理的？

- 【考察点】简历核心表述"设计并部署高可用 Kubernetes 架构"，这是最容易被连环追问的一段，答不好整个简历可信度崩。
- 【参考回答】3 个控制节点是给 apiserver、etcd、controller-manager、scheduler 做高可用，etcd 3 节点容忍 1 个故障。但有个现实问题：kubectl 和组件连 apiserver 需要一个固定入口，我们内网环境在控制面前面放了一个负载均衡入口（VIP/反向代理），把 6443 分发到 3 个控制节点；如果入口本身就是单点，那这个集群只能说"控制面组件高可用、入口单点"。另外数据面没有单点：5 个 worker 节点，业务 Deployment 多副本 + 反亲和性跨节点分布，有状态服务用 Longhorn 3 副本。证书这块：RKE2 自己签发管理集群证书（apiserver、etcd、kubelet 的），不用手动维护；应用层证书用 cert-manager + ClusterIssuer 自动签发续期，Rancher 的 CA 证书做成 Secret 供 ClusterIssuer 引用，应用域名证书到期前自动轮换。
- 【追问】
  - Q：3 个控制节点怎么初始化的，一个命令描述？A：第一台装 RKE2，config.yaml 里配 token，`systemctl enable --now rke2-server`；后两台 config.yaml 加 `server: https://<第一台IP>:9345` 和同样的 token，加入后自动组成 etcd 集群。
  - Q：worker 节点怎么加入？A：装 RKE2 agent，config.yaml 配 `server: https://<控制面入口>:9345` 和 token，`systemctl enable --now rke2-agent`，加入后 kubectl get nodes 验证 Ready。
  - Q：如果面试官问"你们控制面入口挂了会怎样"，你怎么圆？A：诚实说入口节点是当时的简化点，生产上应该用 keepalived VIP 或专业 LB 做入口高可用，这是集群演进计划里的一项。
- 【岗位标注】运维 / DevOps

### Q14. 为什么默认拥有集群全部权限？用的是哪个用户？怎么切换登录用户？

默认之所以"什么都能做"，是因为你当前 kubectl 用的是 **集群管理员身份**，它通过 kubeconfig 里的客户端证书认证，被识别为 `system:masters` 组成员，而这个组绑定了内置的 `cluster-admin` ClusterRole，所以拥有全集群所有资源的完整权限。

**默认管理员身份是怎么来的**

以 `kubeadm` 搭建的集群为例，初始化后会生成 `/etc/kubernetes/admin.conf`，把它拷贝到 `~/.kube/config` 后，kubectl 就自动使用它。

这个文件里的客户端证书通常长这样：

```text
CN=kubernetes-admin
O=system:masters
```

API Server 解析证书时：

- **CN** → 用户名（`kubernetes-admin`）
- **O** → 用户组（`system:masters`）

`system:masters` 组通过内置的 `ClusterRoleBinding` 绑定了 `cluster-admin`，所以这个身份拥有所有权限。

可以用下面命令验证：

```bash
# 查看当前用的哪个身份
kubectl config view --minify

# 查看证书里的 CN 和 O
kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' \

  | base64 -d | openssl x509 -noout -subject

# 查看谁绑定了 cluster-admin
kubectl get clusterrolebinding cluster-admin -o yaml
```

**怎么切换/改变登录用户**

有几种方式：

**1. 切换 kubeconfig context（最常用）**

```bash
# 查看所有 context
kubectl config get-contexts

# 切换到另一个 context
kubectl config use-context dev-context
```

**2. 指定不同的 kubeconfig 文件**

```bash
kubectl --kubeconfig=/path/to/dev.kubeconfig get pods
```

**3. 临时伪装成其他用户（调试用）**

```bash
# 以 dev-user 身份执行命令
kubectl get pods --as=dev-user -n dev

# 以某个组身份
kubectl get pods --as=alice --as-group=dev-team
```

注意：伪装要求当前用户本身有 `impersonate` 权限，管理员才可以用。

**4. 创建新的受限用户**

如果要给开发或运维创建独立账号，流程是：

```text
生成私钥 → 创建 CSR（设置 CN/O）→ 用集群 CA 签发证书 → 写入 kubeconfig → 通过 RBAC 绑定对应 Role
```

具体步骤前面已经聊过了，需要我展开讲一遍完整操作吗？

### Q15. 给一个运维/开发不同角色配置不同资源权限的例子

假设集群里有 `dev` 命名空间给开发用，运维需要看整个集群。可以这样配：

**1. 给开发：只能管理 `dev` 命名空间**

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: developer
  namespace: dev
rules:
  - apiGroups: ["", "apps"]
    resources: ["pods", "deployments", "services", "configmaps"]
    verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: dev
subjects:
  - kind: User
    name: dev-user
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: developer
  apiGroup: rbac.authorization.k8s.io
```

效果：`dev-user` 只能在 `dev` 命名空间里查看和管理 Pod、Deployment、Service、ConfigMap，不能访问 `prod` 等其他命名空间。

**2. 给运维：可以查看整个集群**

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ops-viewer
rules:
  - apiGroups: [""]
    resources: ["nodes", "namespaces", "pods"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "daemonsets", "statefulsets"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ops-viewer-binding
subjects:
  - kind: User
    name: ops-user
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: ops-viewer
  apiGroup: rbac.authorization.k8s.io
```

效果：`ops-user` 可以查看整个集群的节点、命名空间、Pod、Deployment 等，但不能删除资源。

**3. 验证权限**

```bash
kubectl auth can-i list pods --as=dev-user -n dev
kubectl auth can-i list pods --as=dev-user -n prod
kubectl auth can-i get nodes --as=ops-user
kubectl auth can-i delete nodes --as=ops-user
```

预期结果：

| 命令 | 结果 |
| --- | --- |
| 开发在 `dev` 列 Pod | `yes` |
| 开发在 `prod` 列 Pod | `no` |
| 运维查看节点 | `yes` |
| 运维删除节点 | `no` |

**生产建议**

- 开发权限建议绑定到 **Group**，比如 `dev-team`，人员变动时不用改 RBAC。
- 运维如果需要管理权限，可以直接用内置的 `admin` 或 `cluster-admin` ClusterRole，但 `cluster-admin` 权限过大，要慎用。
- 永远遵循最小权限原则，不要随便给 `*` 资源和 `*` verbs。

### Q16. 反直觉故障合集：Service 通了但 Pod 不通？滚动更新卡住？节点重启后 Pod 没回来？conntrack 表满？

- 【考察点】刁钻题压轴，考"见过世面"——这些反直觉现象只有真排过才会知道。
- 【参考回答】我挑三个最有代表性的：第一，Service 有 IP 有 endpoints 但访问不通，先查 kube-proxy 是不是没生成规则（iptables 模式 Service 多时规则全量重写慢、或者 kube-proxy 挂了），再查 conntrack 表满——`dmesg` 里报 `nf_conntrack: table full, dropping packet`，症状是连接间歇性超时，处理是调大 `net.netfilter.nf_conntrack_max` 并排查大量短连接（TIME_WAIT 堆积）。第二，滚动更新卡在 Progressing，新 Pod 一直 ContainerCreating 或 not Ready，describe 新 RS 的 Pod 看 events，常见是 PVC 没绑上、探针失败、镜像拉不下来；`kubectl rollout undo` 快速回退。第三，节点重启后 Pod 没被调度回来——先看节点是不是 Ready，再看 Pod 是不是被驱逐后其他节点也没资源，Deployment 管理的会自动重建，但如果是单副本且节点一直 NotReady，Pod 会卡在 Pending；还有一种情况是 Pod 用了 hostPath 或 nodeName 绑定，重启后只能回原节点。这三个的共同点是：现象反直觉，但都逃不出"describe + logs + events + 系统日志"这套固定流程。
- 【追问】
  - Q：conntrack 表满为什么会导致 Service 不通？A：Service 转发（DNAT/SNAT）依赖 conntrack 跟踪连接，表满后新连接建不起来，表现为间歇性失败，而不是全挂。
  - Q：节点重启后单副本有状态服务没回来，最危险的是什么？A：如果节点起不来，数据盘跟着节点走（Local 存储），业务直接不可用——这正是为什么有状态服务要用 Longhorn 这种分布式存储并保证多副本。
- 【岗位标注】运维 / DevOps / AI 运维
