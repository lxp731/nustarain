---
title: Kubernetes 面试问答·进阶篇（24 题）
date: 2026-10-09 08:30:00
categories: 技术
tags:
  - K8S
  - 面试

---

本文是《Kubernetes 面试问答》系列的进阶篇，共 24 题，讲原理与进阶用法：控制器 Reconcile 循环、Pod 创建全流程与 Scheduler 调度、kube-apiserver 准入控制、kube-proxy iptables/IPVS、CNI 选型、CoreDNS 与 dnsPolicy/ndots、StatefulSet 稳定标识与 Headless Service、StorageClass/CSI/Longhorn、Helm Chart、HPA 自定义指标、etcd 备份恢复与 RKE2、RBAC 与 ServiceAccount 深化、蓝绿/金丝雀发布、探针最佳实践。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

> 系列导航：{% post_link 技术/kubernetes-interview-basic 基础篇（20题） %} / {% post_link 技术/kubernetes-interview-practical 刁钻篇（16题） %}

---

### Q1. Deployment 滚动更新的参数 maxSurge / maxUnavailable 到底怎么算？

- 【考察点】真考细节，很多人只背了 25% 不知道含义，DevOps 岗必问。
- 【参考回答】maxSurge 是"允许超出期望副本数多少个（或百分比）"，maxUnavailable 是"允许最多多少个（或百分比）副本不可用"。默认各 25%，replicas=4 时就是最多 5 个 Pod（多 1 个新的），最少 3 个可用（少 1 个旧的）。百分比按副本数取整，两者配合决定滚动节奏：maxUnavailable=1 保证至少 3 个在服务，适合不能降容量的服务；maxSurge=0、maxUnavailable=1 是"先删后建"，适合资源紧张。生产上发布必须关注 `kubectl rollout status` 是否卡在 Progressing，卡住 99% 是新 Pod 一直不 Ready（探针失败、镜像拉取失败、PVC 挂载失败），describe 新 RS 的 Pod 看原因。
- 【追问】
  - Q：发布时为什么有时看到新旧 Pod 同时存在？A：正常，滚动更新就是新旧 RS 并存、此消彼长的过程，直到新 RS 全部 Ready 旧 RS 缩到 0。
  - Q：maxSurge 用百分比时边界怎么处理？A：replicas=3、maxSurge=25% 时按公式算出来可能不是整数，实际按向上取整/向下取整的规则，一般最大多 1 个；精确控制就写整数。
  - Q：回滚后 revisionHistoryLimit 有什么用？A：控制保留几个历史 RS 用于回滚，默认 10，太多占 etcd 和资源，太少回滚选项少。
- 【岗位标注】DevOps / 运维

**补充：maxSurge=0、maxUnavailable=1 这两个参数是怎么控制 Pod 的？**

`maxSurge=0、maxUnavailable=1` 是 Deployment 滚动更新里一种 **“先删后建、不额外占用资源”** 的保守策略。

**两个参数分别控制什么**

| 参数 | 含义 | `maxSurge=0` / `maxUnavailable=1` 的效果 |
| --- | --- | --- |
| `maxSurge` | 更新时最多允许 **超出期望副本数** 几个 Pod | 不允许临时多出新 Pod，更新期间总 Pod 数不会超过 `replicas` |
| `maxUnavailable` | 更新时最多允许几个 Pod **不可用** | 每次最多先让 1 个旧 Pod 下线，再补 1 个新 Pod |

**它具体怎么控制 Pod 替换**

假设 `replicas=3`，当前有 3 个旧版本 Pod：

1. 滚动更新开始时，因为 `maxSurge=0`， **不能先创建新 Pod**；
2. 因为 `maxUnavailable=1`，可以先让 **1 个旧 Pod 不可用**，也就是先删除 1 个旧 Pod；
3. 删除后，当前可用 Pod 变成 2 个；
4. 然后创建 1 个新 Pod；
5. 新 Pod 通过 `readinessProbe` 就绪后，继续删除下一个旧 Pod；
6. 重复这个过程，直到 3 个 Pod 全部替换成新版本。

整个过程是：

```text
旧 Pod 3 个
→ 删 1 个旧 Pod（剩 2 个旧 Pod，总 Pod 数 = 2）
→ 建 1 个新 Pod（2 旧 + 1 新，总 Pod 数 = 3）
→ 新 Pod Ready 后，再删 1 个旧 Pod
→ 再建 1 个新 Pod
→ 循环直到全部替换完成
```

**这个配置的特点**

- **优点**：不会额外占用资源，更新期间 Pod 总数不会超过期望副本数。
- **缺点**：更新过程中会短暂少一个可用 Pod，存在容量下降窗口。
- **适用场景**：节点资源紧张、无法承受额外 Pod，但又不想完全停机。

**和常见配置对比**

| 配置 | 行为 | 特点 |
| --- | --- | --- |
| `maxSurge=1, maxUnavailable=0` | 先建新 Pod，再删旧 Pod | 零停机，但会短暂多一个 Pod |
| `maxSurge=0, maxUnavailable=1` | 先删旧 Pod，再建新 Pod | 不占额外资源，但会短暂少一个 Pod |
| `maxSurge=1, maxUnavailable=1` | 同时建新、删旧 | 速度更快，但新旧 Pod 并发变化 |

注意：`maxSurge` 和 `maxUnavailable` 不能同时为 0，否则滚动更新无法推进。

另外，这种策略要真正安全，最好配合 `readinessProbe`、`minReadySeconds`、`preStop` 和 `terminationGracePeriodSeconds`，否则新 Pod 还没准备好就被接入流量，或者旧 Pod 被立即杀掉，都可能造成请求失败。

### Q2. 控制器模式（Reconcile 循环）是什么？拿 Deployment 举例说明。

- 【考察点】这是理解 K8s 的底层思维，能讲清楚说明不是只会 yaml。
- 【参考回答】K8s 的控制器都遵循"期望状态 vs 实际状态"的调谐循环：控制器的 informer 监听 etcd 里的对象变化，把对象的 spec 当作期望状态，通过 list/watch 拿到实际状态，两者不一致就执行操作让它收敛，操作完再汇报 status。拿 Deployment 举例：期望是 replicas=3，调谐时发现当前只有一个 RS 只有 2 个 Pod，就创建一个新 RS 或者给现有 RS 扩到 3；Pod 被删了，监听事件触发新一轮调谐，重新补一个。这个循环是异步、无锁的，任何时刻有人改了 spec 或实际状态跑偏，下一轮调谐都会拉回来——所以"删掉 Deployment 管理的 Pod 它一定会回来"，因为它符合期望状态。
- 【追问】
  - Q：控制器之间会打架吗？A：关键在所有权和标签选择器。Deployment 通过 ownerReference 声明对 RS 的所有权，RS 又 ownerReference 声明对 Pod 的所有权，垃圾回收器按 ownerReference 清理；标签选择器写太宽会同时命中多个控制器的 Pod，这就是"删了又出现/两个控制器抢 Pod"的原因。
  - Q：调谐失败会怎样？A：会退避重试（指数退避），status 里记录 condition 和错误，比如 Deployment 的 Progressing condition 报错；不会无限快速重试把 apiserver 打爆。
- 【岗位标注】通用 / 运维

**补充：标签选择器写太宽为什么会命中多个控制器的 Pod？**

这句话的意思是： **Kubernetes 控制器不是按“我创建的 Pod”来管，而是按“标签选择器匹配到的 Pod”来管。**

如果你的选择器写得太宽，就可能把别的控制器、甚至手动创建的 Pod 也选进来，于是多个控制器会同时认为这些 Pod 归自己管。

**什么是“标签选择器太宽”？**

比如你有一个 Deployment：

```yaml
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
        version: v1
```

它的选择器是 `app: web`。

如果集群里还有另一个 Deployment：

```yaml
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
        version: v2
```

两个控制器都通过 `app: web` 找 Pod。

那么所有带 `app=web` 的 Pod，都会被这两个控制器同时看到。

这就叫 **选择器太宽**：它没有把“只属于我的 Pod”精确圈出来，而是圈了一大片。

**为什么会出现“删了又出现”？**

控制器的工作方式是：

```text
不断看：现在匹配我 selector 的 Pod 有几个？
如果少于 replicas：补 Pod
如果多于 replicas：删 Pod
```

假设 Deployment A 期望 3 个 Pod，Deployment B 期望 2 个 Pod，但它们都选了 `app=web`。

集群里现在有 5 个带 `app=web` 的 Pod：

- A 看到 5 个，但自己只要 3 个，于是删掉 2 个；
- B 看到剩下 3 个，但自己只要 2 个，于是再删 1 个；
- A 又发现只剩 2 个，不够 3 个，于是再补 1 个；
- B 又发现数量不对，又删或又补。

于是 Pod 会不断被创建、删除，看起来就是 **删了又出现**。

**为什么会有“两个控制器抢 Pod”？**

因为 Kubernetes 的 ReplicaSet / Deployment 并不严格区分“这个 Pod 是不是我创建的”。

它更关心： **这个 Pod 的标签是否匹配我的 selector。**

所以一旦两个控制器的 selector 重叠，它们就会同时认为某些 Pod 属于自己，进而互相调整副本数。

**怎么避免？**

- **Deployment 的 selector 要尽量精确**，不要只用一个很泛的 `app: web`。
- 通常让 `selector.matchLabels` 和 `template.metadata.labels` 保持一致。
- 不同 Deployment 之间不要让 selector 重叠。
- 不要手动给控制器管理的 Pod 改标签，否则可能让它脱离原控制器，或被别的控制器接管。
- 创建新 Deployment 前，先用 `kubectl get pods -l app=web --show-labels` 看看现有 Pod 是否会被误选。

一句话记： **标签是 Pod 的身份，selector 是控制器的认领规则。认领规则写太宽，就会把别人的 Pod 也认成自己的。**

### Q3. Scheduler 调度一个 Pod 的完整流程？

- 【考察点】进阶调度题，能答出"过滤-打分"说明理解到位。
- 【参考回答】scheduler 是 list/watch 未调度的 Pod（spec.nodeName 为空），进入调度队列后分两步：先过滤（Filtering/预选），把不满足硬性条件的节点剔除——比如资源 requests 不够、有 NoSchedule 污点且 Pod 没对应 toleration、required nodeAffinity 不匹配、端口冲突；剩下候选节点后打分（Scoring/优选），按资源均衡（least requested）、亲和性权重、Pod 分布等策略给候选节点打分，选最高分的绑定（Bind），写回 Pod 的 spec.nodeName，然后 kubelet 看到自己被指派就拉镜像启动容器。调度是可插拔的，可以写自定义调度器或给 Pod 指定 schedulerName。所以 Pod Pending 的第一反应就是：是不是 filter 全灭了——describe 里会明确写出"0/8 nodes available"及每个节点被拒的原因。
- 【追问】
  - Q：nodeAffinity 的 required 和 preferred 分别在哪个阶段生效？A：required 在 Filter 阶段（不满足直接排除），preferred 在 Score 阶段（满足的节点加分，不满足也能被选中）。
  - Q：Pod 一直 Pending 且报 0/8 nodes available，具体怎么看原因？A：`kubectl describe pod` 的 Events 里会列出每个节点被拒的逐条原因（Insufficient cpu、Untolerated taint 等），这是最直接的答案。
- 【岗位标注】运维

### Q4. 在 K8S 中创建一个 Pod 经历哪些流程？

在 Kubernetes 中创建一个 Pod，本质上是多个组件通过 **API Server + etcd + List-Watch 机制** 协作完成的。整体流程可以分成三大阶段：

**1. 提交与持久化：用户 → API Server → etcd**

用户通过 `kubectl apply -f pod.yaml` 提交 Pod 定义，kubectl 把 YAML 转成 JSON 发给 **API Server**。

API Server 会依次做：

- **认证**：确认你是谁；
- **授权**：确认你有没有权限创建 Pod；
- **准入控制**：执行 Mutating/Validating Webhook、资源配额、安全策略等校验；
- **写入 etcd**：校验通过后，把 Pod 对象写入 etcd，此时 Pod 状态为 **Pending**。

这一步完成后，Pod 还只是 etcd 里的一条记录，并没有真正运行。

**2. 调度：Scheduler 选择节点并绑定**

**kube-scheduler** 通过 List-Watch 监听 API Server，发现 `nodeName` 为空、处于 Pending 状态的 Pod。

调度过程通常分为：

- **预选 / Filter**：排除不满足条件的节点，例如 CPU/内存不足、污点不匹配、亲和性不满足等；
- **优选 / Score**：对剩余节点打分，例如负载更低、拓扑更优、镜像缓存更好的节点得分更高；
- **绑定 / Bind**：选择得分最高的节点，调用 API Server 把 Pod 的 `spec.nodeName` 设置为目标节点，并回写 etcd。

Pod 在生命周期中只会被调度一次，绑定后不会重新调度到其他节点。

**3. 节点执行：Kubelet 拉起 Pod**

目标节点上的 **Kubelet** 监听到这个 Pod 被绑定到自己后，开始执行创建流程：

1. **创建 Pod 沙箱**：通过 CRI 调用容器运行时创建 Pause 容器，建立 Pod 的网络命名空间和 PID 命名空间；
2. **配置网络**：调用 CNI 插件为 Pod 分配 IP、配置路由和网络策略；
3. **挂载存储**：通过 CSI 或本地驱动挂载 Volume，例如 PVC、ConfigMap、Secret；
4. **启动 Init 容器**：如果有 Init 容器，会按顺序串行执行，全部成功后才启动主容器；
5. **启动业务容器**：拉取镜像，启动主容器和 Sidecar 容器，并执行 `postStart` 钩子；
6. **健康检查**：Kubelet 持续执行 StartupProbe、LivenessProbe、ReadinessProbe；
7. **状态上报**：Kubelet 把 Pod 状态上报给 API Server，API Server 同步到 etcd，Pod 最终进入 **Running**。

**简化流程**

```text
kubectl apply
  → API Server 认证/授权/准入控制
  → 写入 etcd，Pod = Pending
  → Scheduler 监听未调度 Pod
  → 预选 + 优选，选择节点
  → 绑定 nodeName 并回写 etcd
  → Kubelet 监听并接管
  → 创建 Pause 容器、配置 CNI、挂载 CSI
  → 启动 Init 容器
  → 启动业务容器
  → Kubelet 上报状态
  → Pod = Running
```

如果 Pod 是通过 Deployment、StatefulSet 等控制器创建的，用户实际提交的是控制器对象，控制器再根据模板创建 Pod，但 Pod 本身的创建和调度流程仍然一样。

### Q5. kube-apiserver 处理一个请求的完整流程？准入控制器是什么？

- 【考察点】进阶必考，能区分"会用"和"懂原理"，运维岗尤其看重。
- 【参考回答】请求链路是：认证（Authentication）→ 鉴权（Authorization）→ 准入（Admission）→ 写入 etcd。认证确认"你是谁"，支持客户端证书、token（ServiceAccount JWT）、基本认证，kubectl 用的 kubeconfig 里就是客户端证书或 token。鉴权确认"你能干什么"，默认 RBAC 模式，按 apiGroups/resources/verbs 匹配。准入是写入 etcd 前的最后一道关卡，分 MutatingAdmissionWebhook（能改请求，比如给 Pod 注入默认值、注入 sidecar）和 ValidatingAdmissionWebhook（只能校验，比如拒绝不符合 LimitRange 的请求），还有内置的 LimitRanger、ResourceQuota、NamespaceLifecycle 都是准入控制器。apiserver 每收到写请求都会走这套链，所以它是唯一入口这句话是字面意思。
- 【追问】
  - Q：apiserver 怎么知道 ServiceAccount token 是有效的？A：token 是 JWT，由 controller-manager 签发，apiserver 验证签名和过期时间；新版用 TokenRequest API 签发短时 token 并绑定 audience。
  - Q：准入控制器举例说明实际场景？A：Rancher 会在集群里装自己的 webhook 校验/改写请求；Longhorn 也有 mutating webhook 给 Pod 注入挂载参数；cert-manager 用 webhook 校验 Certificate 资源。
- 【岗位标注】运维 / DevOps

### Q6. kube-proxy 的 iptables 和 IPVS 模式区别？Service 的转发原理？

- 【考察点】网络原理进阶题，能答出 IPVS 说明真研究过。
- 【参考回答】kube-proxy 把 Service 的虚拟 IP 转成实际 Pod IP，iptables 模式是经典的：每个 Service 生成一条 DNAT 规则链，按 1/3 概率（随机）转发到后端 Pod，endpoints 变化时重写整条链。优点是简单、通用；缺点是规则是链式的，Service 多到几百上千条时查找是 O(n)，性能下降，规则更新全量重写。IPVS 模式用内核的 IPVS 模块，基于哈希表，支持 wrr、lc 等负载算法，Service 多时性能稳定，是生产大集群的推荐模式。RKE2 可以通过 kube-proxy-mode 配置切换。另外提一句：Service 转发不感知后端 Pod 健康，Pod 挂了但还没摘除 endpoints 时，流量会打到失败 Pod，所以 readiness 探针摘除很重要。
- 【追问】
  - Q：怎么看当前集群用的是什么模式？A：`kubectl get cm -n kube-system kube-proxy -o yaml` 看 mode 字段，或者看节点上 kube-proxy 进程参数。
  - Q：NodePort 和 ClusterIP 底层都是 iptables 吗？A：是，NodePort 就是在 ClusterIP 的 DNAT 基础上再加一条端口映射规则（PREROUTING/OUTPUT 链），LoadBalancer 又包一层外部 LB。
- 【岗位标注】运维 / DevOps

### Q7. CNI 是什么？flannel 和 calico 有什么区别？怎么选？

- 【考察点】网络选型是架构题，简历写"高可用架构"，CNI 必须懂。
- 【参考回答】CNI（Container Network Interface）是容器网络的插件规范，负责给 Pod 分配 IP、配置网络命名空间、打通跨节点通信。K8s 本身不实现 Pod 网络，装什么 CNI 就是什么网络方案。flannel 默认用 VXLAN 做 overlay 隧道，简单、好排障、内核自带支持，但因为是隧道封包，性能略差，且默认不带 NetworkPolicy；calico 用 BGP 在三层直连（也可 IPIP），性能好、支持 NetworkPolicy，生产大规模首选。RKE2 默认装 calico，K3s 默认 flannel——这也是我选型时的一个现实理由：开发测试 K3s 图省事，生产 RKE2 用 calico 图性能和策略能力。选型就看三点：性能要求、是否需要 NetworkPolicy、团队排障能力。
- 【追问】
  - Q：NodePort 不通，怎么区分是 CNI 问题还是 kube-proxy 问题？A：先测 Pod 间网络（`kubectl exec` 里 ping 别的 Pod IP），通说明 CNI 正常，再查 kube-proxy 规则和 Service endpoints。
  - Q：calico 的 IPIP 和 BGP 模式区别？A：IPIP 是隧道封包，跨子网也能用；BGP 直连不封包，性能最好，但要求节点二层互通，跨网段要配 BGP peer。
- 【岗位标注】运维 / DevOps

### Q8. CoreDNS 在 K8S 中扮演什么角色？

CoreDNS 是 Kubernetes 集群里的 **DNS 服务器和服务发现组件**，核心作用是让 Pod 能用服务名访问其他服务，而不是写死容易变化的 Pod IP。

**它主要做两件事**

| 能力 | 说明 |
| --- | --- |
| **集群内服务发现** | 把 `my-service.default.svc.cluster.local` 解析成 Service 的 ClusterIP |
| **外部域名解析** | 把 `www.example.com` 这类外部域名转发给上游 DNS，比如节点上的 `/etc/resolv.conf` |

**它是怎么工作的**

1. CoreDNS 以 Deployment 形式运行在 `kube-system` 命名空间。
2. 它对外暴露一个名为 `kube-dns` 的 Service，这个 Service 的 ClusterIP 就是集群 DNS 地址。
3. Kubelet 启动 Pod 时，会把 DNS 服务器地址写入 Pod 的 `/etc/resolv.conf`。
4. Pod 访问 `database-svc` 时，会先向 CoreDNS 查询域名，拿到 ClusterIP 后再发起请求。
5. CoreDNS 的 `kubernetes` 插件会监听 API Server，自动为 Service、Pod 生成 DNS 记录。

**它的配置核心是 Corefile**

CoreDNS 基于插件链工作，常见插件有：

- **kubernetes**：解析集群内 Service/Pod 域名。
- **forward**：把非集群域名转发到上游 DNS。
- **cache**：缓存 DNS 结果，默认 30 秒。
- **health / ready**：提供健康和就绪检查。
- **prometheus**：暴露监控指标。
- **reload**：支持配置热更新。
- **loadbalance**：对多 IP 记录做轮询。

**一个完整访问链路**

```text
Pod A 访问 database-svc
  → 查 /etc/resolv.conf，nameserver 指向 kube-dns
  → CoreDNS 解析 database-svc.default.svc.cluster.local
  → 返回 Service 的 ClusterIP
  → kube-proxy 把流量转发到后端 Pod
```

这里可以把它和前面聊到的网络组件串起来： **CNI 负责 Pod 之间能通，kube-proxy 负责把 Service 流量转到后端 Pod，CoreDNS 负责把服务名解析成 Service IP。**

**几个容易混淆的点**

- CoreDNS 的 Deployment 叫 `coredns`，但它暴露的 Service 叫 `kube-dns`，这是为了兼容旧组件。
- Pod 默认 `dnsPolicy: ClusterFirst`，会优先使用 CoreDNS。
- `ndots:5` 意味着域名里点少于 5 个时，会先拼 search 后缀再查，所以访问外部域名最好用 FQDN，比如 `www.example.com.`。
- 大规模集群里可以用 NodeLocal DNSCache 降低 CoreDNS 压力。

需要的话我可以再帮你梳理一下 `dnsPolicy` 几种策略的区别，或者 Corefile 怎么自定义。

Kubernetes服务发现，CoreDNS和LocalDNS怎么配合

### Q9. dnsPolicy 怎么配？四种策略有什么区别？

可以，但严格来说，`dnsPolicy` 不是 Deployment 自己的字段，而是 **Pod 模板里的字段**。

所以它要写在：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: demo
  template:          # 这里是 Pod 模板
    metadata:
      labels:
        app: demo
    spec:
      dnsPolicy: ClusterFirst   # ✅ 写在 pod spec 里
      containers:
        - name: app
          image: nginx:latest
```

不能这样写：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  dnsPolicy: ClusterFirst   # ❌ 这个位置无效
```

**四种常用值**

| 值 | 含义 | 典型场景 |
| --- | --- | --- |
| `ClusterFirst` | 默认值，优先用 CoreDNS | 普通业务 Pod |
| `Default` | 继承节点 `/etc/resolv.conf` | 不需要集群内服务发现 |
| `ClusterFirstWithHostNet` | hostNetwork Pod 仍用 CoreDNS | 使用 `hostNetwork: true` 的 Pod |
| `None` | 不用集群默认 DNS，需配合 `dnsConfig` | 自定义 nameserver |

如果用了 `dnsPolicy: None`，通常要补 `dnsConfig`，例如：

```yaml
dnsPolicy: None
dnsConfig:
  nameservers:
    - 223.5.5.5
  searches:
    - default.svc.cluster.local
  options:
    - name: ndots
      value: "2"
```

简单记： **Deployment 不直接配 `dnsPolicy`，要写在 `spec.template.spec.dnsPolicy` 下面。**

**补充：dnsPolicy 只有 ClusterFirst 和 Default 两种吗？**

不止，Kubernetes 里一共有 **4 种**`dnsPolicy`：`ClusterFirst`、`Default`、`ClusterFirstWithHostNet`、`None`。

**四种策略对比**

| 策略 | 行为 | 适用场景 |
| --- | --- | --- |
| `ClusterFirst` | 默认值，优先用 CoreDNS 解析；解析不了再转发到上游 DNS | 普通业务 Pod |
| `Default` | 直接用节点 `/etc/resolv.conf` 里的 DNS，不走 CoreDNS | 不需要集群服务发现，比如某些批处理任务 |
| `ClusterFirstWithHostNet` | Pod 用了 `hostNetwork: true` 时仍走 CoreDNS | 网络插件、监控 Agent 等需要 hostNetwork 又要服务发现的场景 |
| `None` | 完全不用集群默认 DNS，必须配合 `dnsConfig` 自定义 | 需要指定特定 nameserver、search 域或 ndots |

**两个容易踩坑的点**

**1. `hostNetwork: true` 时不能用 `ClusterFirst`**

如果 Pod 开启了 `hostNetwork`，`dnsPolicy` 必须改成 `ClusterFirstWithHostNet` 或 `Default`，否则 K8s 会拒绝创建。

```yaml
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet   # ✅
```

**2. `None` 必须配 `dnsConfig`**

选了 `None` 就表示"我自己管 DNS"，所以必须显式写 `dnsConfig`，否则会报错。

```yaml
dnsPolicy: None
dnsConfig:
  nameservers:
    - 8.8.8.8
    - 223.5.5.5
  searches:
    - default.svc.cluster.local
  options:
    - name: ndots
      value: "2"
```

**怎么选**

- 绝大多数业务 Pod： **`ClusterFirst`**（默认，不用写）。
- 用了 `hostNetwork` 又要服务发现： **`ClusterFirstWithHostNet`**。
- 不需要集群内服务发现： **`Default`**。
- 要自定义 DNS 服务器或搜索域： **`None` + `dnsConfig`**。

### Q10. ndots 和 searches 是什么？怎么影响 DNS 解析性能？

这两个参数都写在 Pod 的 `/etc/resolv.conf` 里，用来控制 **域名解析顺序** 和 **解析尝试路径**。

**`searches`：域名补全规则**

`searches` 是 DNS 搜索域列表。Kubernetes 默认会给 Pod 配置：

```text
search default.svc.cluster.local svc.cluster.local cluster.local
```

它的作用是：当你在 Pod 里访问一个 **短域名** 时，DNS 解析器会自动把它拼上这些后缀依次尝试。

比如你在 `default` 命名空间的 Pod 里访问 `redis`：

```text
redis.default.svc.cluster.local   ← 第1次尝试
redis.svc.cluster.local           ← 第2次尝试
redis.cluster.local               ← 第3次尝试
redis                             ← 第4次尝试，最终成功
```

这样你不需要写完整域名，直接访问 `redis` 就能解析到同命名空间下的 Service。

**`ndots`：决定"什么时候走 search"**

`ndots` 是一个阈值，默认值是 **5**。

它的规则是：

| 域名中 `.` 的数量 | 与 `ndots` 比较 | 解析行为 |
| --- | --- | --- |
| 小于 `ndots` | `< 5` | **先** 拼 search 后缀尝试，全部失败后再用原始域名查 |
| 大于等于 `ndots` | `≥ 5` | **先** 用原始域名直接查，失败后再拼 search 后缀 |

**默认 `ndots:5` 的性能问题**

这是生产环境里一个经典的坑。

比如你的应用要访问外部域名 `www.example.com`（只有 2 个点，小于 5），解析过程会变成：

```text
www.example.com.default.svc.cluster.local   → NXDOMAIN
www.example.com.svc.cluster.local           → NXDOMAIN
www.example.com.cluster.local               → NXDOMAIN
www.example.com                             → 成功
```

**本来 1 次查询就能解决，实际发了 4 次**，每次 NXDOMAIN 都是一次完整的 DNS 往返。高并发场景下会显著拖慢请求，甚至打满 CoreDNS。

**优化方案**

**方案一：降低 `ndots`**

大多数生产集群会把 `ndots` 降到 **2**：

```yaml
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
```

这样 `www.example.com`（2 个点，≥ 2）会直接作为 FQDN 查询，不再走 search 后缀。

**方案二：代码里用 FQDN（末尾加 `.`）**

```text
redis.default.svc.cluster.local.   ← 末尾的点表示绝对域名，跳过 search
www.example.com.                   ← 同样跳过 search
```

末尾的 `.` 告诉解析器"这是完整域名，不要拼后缀"，一次查询搞定。

**一句话总结**

- **`searches`**：定义域名后缀补全规则，让你能用短名访问集群内服务。
- **`ndots`**：定义"多少点以上才算完整域名"，默认 5 会导致外部域名解析被放大 34 倍。
- **生产建议**：`ndots` 降到 2，或者代码里用 FQDN 格式。

### Q11. StatefulSet 怎么保证"稳定标识"？Headless Service 有什么用？

- 【考察点】有状态应用的灵魂题，AI 运维岗（数据库/向量库容器化）必问。
- 【参考回答】StatefulSet 给每个 Pod 一个稳定且唯一的网络标识：`<statefulset名>-<序号>`，比如 pg-0、pg-1，序号从 0 开始，创建、扩缩容、升级都按序号有序进行，Pod 重建后名字和主机名不变。配合 Headless Service（clusterIP: None），每个 Pod 会拿到自己的 DNS 记录 `pg-0.pg-hs.default.svc.cluster.local`，这就是数据库互相发现（比如 Postgres 主从、etcd 集群）的基础——节点失联重连还是用这个名字找到对方。存储上 volumeClaimTemplates 让每个副本有独立的 PVC，Pod 重建后 PVC 不变、数据不丢。所以迁移有状态应用，StatefulSet + Headless + PVC 是三件套。
- 【追问】
  - Q：StatefulSet 缩容会删哪个 Pod？A：序号最大的先删（比如缩到 2 个就删 pg-2），PVC 默认保留，再扩容回来还是原数据。
  - Q：Headless Service 的 DNS 为什么能列出所有 Pod IP？A：Headless Service 不建虚拟 IP，DNS 直接返回后端所有 Pod 的 IP（A 记录），配合 StatefulSet 的 pod DNS 名做点对点解析。
  - Q：Qdrant/Postgres 这类有状态服务在 K8s 上跑要注意什么？A：副本数固定、存储用 Longhorn 这类有副本保障的、节点维护前要 drain 保证数据副本健康、备份要另做。
- 【岗位标注】运维 / AI 运维

**补充：Headless Service 有什么用？和普通 ClusterIP 有什么区别？**

Headless Service 的核心作用是： **不给 Service 分配 ClusterIP，让 DNS 直接返回后端 Pod 的真实 IP，从而让客户端能直接访问具体 Pod，而不是经过 kube-proxy 做负载均衡。**

**和普通 Service 的区别**

| 对比项 | 普通 ClusterIP Service | Headless Service |
| --- | --- | --- |
| ClusterIP | 有 | 无，`clusterIP: None` |
| 负载均衡 | kube-proxy 自动负载 | 不做负载均衡 |
| DNS 解析结果 | 返回一个 ClusterIP | 返回所有后端 Pod 的 IP 列表 |
| 访问方式 | 客户端访问 VIP，由 kube-proxy 转发 | 客户端直接访问 Pod IP 或 Pod 域名 |
| 适用场景 | 无状态服务、微服务间调用 | 有状态服务、点对点通信、自定义负载均衡 |

**配置方式**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
spec:
  clusterIP: None
  selector:
    app: mysql
  ports:
    - port: 3306
```

关键就是这一行：

```yaml
clusterIP: None
```

**DNS 行为**

普通 Service 的域名解析会得到一个 ClusterIP：

```text
mysql.default.svc.cluster.local → 10.96.0.10
```

Headless Service 的域名解析会返回多个 Pod IP：

```text
mysql-headless.default.svc.cluster.local → 10.244.0.5
                                            10.244.0.6
                                            10.244.0.7
```

如果配合 StatefulSet，每个 Pod 还会获得自己的稳定域名：

```text
mysql-0.mysql-headless.default.svc.cluster.local → 10.244.0.5
mysql-1.mysql-headless.default.svc.cluster.local → 10.244.0.6
mysql-2.mysql-headless.default.svc.cluster.local → 10.244.0.7
```

**典型场景**

**1. 有状态服务**

比如 MySQL 主从、Redis 集群、Kafka、Elasticsearch。

这类集群里每个 Pod 身份不同，不能简单做随机负载均衡。

例如 MySQL 主从：

- 写请求必须发到主节点 `mysql-0`；
- 读请求可以发到从节点 `mysql-1`、`mysql-2`；
- 普通 ClusterIP 会随机转发，无法精确选择节点；
- Headless Service 配合 StatefulSet 就能通过稳定域名精确访问某个实例。

**2. 客户端需要知道所有后端实例**

有些客户端想自己实现负载均衡、广播、服务发现，就需要拿到所有 Pod IP。

**3. 点对点通信**

比如分布式缓存、P2P 集群、游戏服务器同步，节点之间需要直接互相访问。

**一句话理解**

普通 Service 像“总机”，你打过去，它帮你转接某个分机；

Headless Service 像“通讯录”，它直接把所有分机号码给你，你自己决定打给谁。

---

K8sService类型、场景和原理，今天全理清了

### Q12. 把外部服务接入 K8s 也可以用 Headless Service 吗？

可以，但要看你说的是哪种“接入”。

**集群内 Pod 访问外部服务：Headless 可以配合用**

如果你是想让集群里的 Pod 访问集群外部的服务，比如外部 MySQL、Redis、Kafka、第三方 API，可以用 **无 selector Service + 手动 Endpoints/EndpointSlice**。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-mysql
spec:
  ports:
    - port: 3306
---
apiVersion: v1
kind: Endpoints
metadata:
  name: external-mysql
subsets:
  - addresses:
      - ip: 192.168.1.100
    ports:
      - port: 3306
```

这样集群内 Pod 访问 `external-mysql.default.svc.cluster.local` 时，流量会被转发到 `192.168.1.100:3306`。

如果这个 Service 是普通 ClusterIP，它会得到一个 ClusterIP，DNS 解析返回 ClusterIP。

如果你把它改成 Headless：

```yaml
spec:
  clusterIP: None
```

那么 DNS 解析会直接返回你手动配置的 Endpoints IP，而不是 ClusterIP。

但这里有个关键点： **Headless 只是改变了 DNS 解析方式，不会自动帮你把外部服务暴露出去。**

**外部客户端访问 K8s 服务：Headless 不是主要方式**

如果是想让外部客户端访问集群里的服务，Headless 通常不是直接方案。

更常见的做法是：

| 场景 | 推荐方式 |
| --- | --- |
| HTTP/HTTPS 服务 | Ingress / Gateway API |
| TCP/UDP 服务 | LoadBalancer 或 NodePort |
| 集群内访问外部域名 | ExternalName Service |
| 集群内访问外部 IP | 无 selector Service + Endpoints |
| 有状态服务多实例发现 | Headless Service + StatefulSet |

比如 Kafka 跑在 StatefulSet 里，内部用 Headless Service 让每个 broker 有稳定域名；但如果外部客户端要连 Kafka，还需要额外通过 NodePort、LoadBalancer 或外部域名来暴露。

**怎么选**

- **外部服务有域名**：用 `ExternalName` 最简单。
- **外部服务只有 IP，需要负载均衡或端口映射**：用无 selector Service + Endpoints。
- **外部客户端要访问集群内服务**：用 Ingress、LoadBalancer、NodePort。
- **需要精确访问某个 Pod 实例**：Headless Service + StatefulSet。

所以严格说： **Headless Service 不是“把外部服务接入 K8s”的通用入口，它更适合做集群内服务发现。**

但如果你只是想给外部 IP 注册一个集群内 DNS 名称，无 selector Service 可以配成 Headless，让 DNS 直接返回外部 IP。

### Q13. StorageClass 有哪些关键字段？CSI 架构是什么？Longhorn 怎么接入的？

- 【考察点】简历写了"Longhorn 动态供给"，存储进阶题必问，AI 运维（向量库持久化）也爱问。
- 【参考回答】StorageClass 关键字段：provisioner（谁创建 PV，Longhorn 是 driver.longhorn.io）、parameters（传给 provisioner 的参数，Longhorn 里如 numberOfReplicas=3、dataLocality、nodeSelector）、reclaimPolicy（Delete/Retain）、allowVolumeExpansion（是否允许扩容）、volumeBindingMode（Immediate 立即绑定 / WaitForFirstConsumer 等 Pod 调度后再绑定，避免 PV 建错节点）。CSI 是存储插件标准，分 controller 插件（建删卷、快照）和 node 插件（节点上挂载、格式化），Longhorn 就是完整 CSI 实现：Longhorn manager 管理卷副本、instance-manager 跑数据面、csi-driver 对接 K8s。用户侧只写 PVC 指定 storageClassName，其余全部自动化——这就是我简历里说的动态供给方案，CMDB 的数据库、Qdrant、Postgres 都是这么给盘的。
- 【追问】
  - Q：volumeBindingMode 选 WaitForFirstConsumer 的场景？A：多可用区集群里不知道 Pod 会调度到哪个区时，先让 Pod 定节点再就近建卷，避免跨区挂载；Longhorn 单集群单机房一般 Immediate 就行。
  - Q：PVC 扩容怎么做？A：StorageClass 开了 allowVolumeExpansion 后，直接改 PVC 的 resources.requests.storage 字段，Longhorn 会在线扩容（文件系统要支持）。
  - Q：Longhorn 卷快照能当备份吗？A：快照在集群内，节点全挂就没了；要异地备份得配 backup target（S3/NFS），定期把快照推到远端，这才是真正的灾备。
- 【岗位标注】运维 / AI 运维

**补充：StorageClass 里 provisioner / reclaimPolicy / volumeBindingMode 是固定的吗？**

> provisioner: [k8s-sigs.io/nfs-subdir-external-provisioner](https://k8s-sigs.io/nfs-subdir-external-provisioner)
> reclaimPolicy: Delete
> volumeBindingMode: Immediate
>
> ---
>
> 这三行配置都是固定的吗？

这三个参数 **都不是固定的**，它们取决于你用的存储后端和运维需求。

**`provisioner`：取决于你装了什么存储驱动**

这个字段必须填集群里 **实际安装的 Provisioner 名称**，不同存储方案对应的值完全不同：

| 存储方案 | provisioner 值 |
| --- | --- |
| NFS（外部提供器） | `k8s-sigs.io/nfs-subdir-external-provisioner` |
| Ceph RBD（CSI） | `rbd.csi.ceph.com` |
| CephFS（CSI） | `cephfs.csi.ceph.com` |
| iSCSI（CSI） | `iscsi.csi.ceph.com` |
| 阿里云盘 | `diskplugin.csi.alibabacloud.com` |
| 腾讯云盘 | `diskcloud.csi.tencentcloud.com` |
| AWS EBS | `ebs.csi.aws.com` |
| GCE PD | `pd.csi.storage.gke.io` |
| 本地目录（开发用） | `k8s-sigs.io/sig-storage-local-static-provisioner` |
| 内置（旧版，已废弃） | `kubernetes.io/aws-ebs`、`kubernetes.io/gce-pd` 等 |

所以 `provisioner` **不是固定的**，它必须和你集群里部署的 CSI Driver 或外部 Provisioner 一致。

**`reclaimPolicy`：三种策略可选**

| 值 | 行为 | 适用场景 |
| --- | --- | --- |
| `Delete` | PVC 删除后，PV 和底层存储一起删除 | 临时环境、开发测试 |
| `Retain` | PVC 删除后，PV 保留，底层存储数据不丢，需手动清理 | 数据库等有状态服务，防止误删 |
| `Recycle`（已废弃） | 旧版效果等价于 `Delete`，但已被标记为 deprecated | 不要用了 |

默认值是 `Delete`，但生产环境数据库类服务通常设为 `Retain`。

**`volumeBindingMode`：两种模式可选**

| 值 | 行为 | 适用场景 |
| --- | --- | --- |
| `Immediate` | PVC 创建后立即匹配 PV 并绑定 | 大多数场景，静态供给和动态供给都可以 |
| `WaitForFirstConsumer` | 先不绑，等 Pod 创建后根据调度结果再绑定 | 需要感知 Pod 调度位置的场景，比如 `local` PV、节点亲和性 |

`WaitForFirstConsumer` 的核心价值是 **延迟绑定**：PVC 创建后不会立刻去找 PV，而是等 Pod 调度到某个节点后，才根据 Pod 的节点亲和性、拓扑约束来选择最合适的 PV。比如 `local` PV 必须用这个模式，否则 Pod 可能被调度到没有对应本地盘的节点上。

**总结**

| 参数 | 是否固定 | 说明 |
| --- | --- | --- |
| `provisioner` | 不固定 | 必须匹配集群里实际的存储驱动 |
| `reclaimPolicy` | 不固定 | 根据数据重要性选 `Delete` 或 `Retain` |
| `volumeBindingMode` | 不固定 | 普通场景用 `Immediate`，需要拓扑感知用 `WaitForFirstConsumer` |

另外提醒一点：`provisioner` 是 **必填** 的，不写的话 PVC 动态供给会失败；而 `reclaimPolicy` 和 `volumeBindingMode` 都有默认值，不写也能用，只是默认值不一定符合你的生产需求。

**补充：provisioner 有哪些取值？这些参数去哪里查？**

不用背，这类东西本来就是 **查出来的**。`provisioner` 的值取决于你集群里装了哪个存储驱动，所以最靠谱的办法是： **看集群里实际有哪些 StorageClass 和 CSI Driver**。

**最实用的查法**

```bash
# 看集群里已经有哪些 StorageClass
kubectl get sc

# 看某个 StorageClass 的 provisioner
kubectl describe sc <name>

# 看集群里注册了哪些 CSI 驱动
kubectl get csidriver
```

`provisioner` 必须和你集群里实际部署的 CSI Driver / External Provisioner 一致，不能凭空编。

**去哪里查某个存储的 provisioner**

| 你想用哪种存储 | 去哪里查 |
| --- | --- |
| 云厂商云盘、文件存储 | 云厂商 AKS/EKS/GKE/ACK 文档里的 CSI 章节 |
| Ceph / NFS / Longhorn / OpenEBS | 对应项目的 GitHub 文档，通常在 “Kubernetes CSI” 或 “StorageClass” 章节 |
| 公司自建存储 | 问部署这个存储的人，或看 `deploy/`、`helm values.yaml` 里的 provisioner 配置 |
| 当前集群已配好的 | `kubectl get sc -o wide` 直接看 |

比如 NFS 动态供给常见两种：

- `nfs.csi.k8s.io`：NFS CSI Driver
- `k8s-sigs.io/nfs-subdir-external-provisioner`：nfs-subdir-external-provisioner

这两个名字不一样，是因为它们是不同组件。你写 StorageClass 时，必须和你实际部署的那个一致。

**这几个字段怎么记**

| 字段 | 要不要背 | 怎么确定 |
| --- | --- | --- |
| `provisioner` | 不背 | 看存储驱动文档，或 `kubectl get csidriver` / `kubectl describe sc` |
| `reclaimPolicy` | 记两个值 | `Delete` 自动删，`Retain` 保留数据 |
| `volumeBindingMode` | 记两个值 | `Immediate` 立即绑，`WaitForFirstConsumer` 等 Pod 调度后再绑 |

**一个很稳的习惯**

以后看到别人给的 StorageClass YAML，不要直接抄 `provisioner`。先确认三件事：

1. 集群里是否已经装了这个 CSI Driver；
2. `kubectl get csidriver` 里有没有对应名字；
3. Helm chart 或 Deployment 里 `PROVISIONER_NAME` 写的是什么。

尤其是 `nfs-subdir-external-provisioner`，它的 `provisioner` 名字要和 Deployment 里的环境变量 `PROVISIONER_NAME` 一致，否则 PVC 会一直 Pending。

所以你现在可以把它当成： **`provisioner` 是驱动名，去驱动文档里查；`reclaimPolicy` 和 `volumeBindingMode` 是策略选择，记住含义就行。**

### Q14. Helm Chart 的目录结构和核心概念？升级回滚怎么做？

- 【考察点】简历写了"熟悉 Helm Charts"，这是 DevOps 岗必考，要能讲出细节。
- 【参考回答】一个 Chart 的标准结构：Chart.yaml（元数据：name、version、apiVersion）、values.yaml（默认参数）、templates/（模板文件，用 Go template 渲染）、charts/（依赖子 chart）、crds/（CRD 定义）。核心概念是"模板 + 参数 = 渲染后的 YAML"，values 可以从命令行 `--set`、`-f values-prod.yaml` 覆盖，优先级 --set 最高。安装 `helm install release-name ./chart -n ns`，升级 `helm upgrade release-name ./chart -n ns`，升级失败用 `helm rollback release-name <版本号>` 回滚，`helm list -n ns` 看 release 状态，`helm template` 只渲染不部署用来预检。Helm 3 的升级是三方合并（用户上次修改、当前模板渲染、现有资源），所以手动 kubectl 改过的字段可能被覆盖——这也是为什么 Helm 管理的资源不要手动改。我们所有应用包括 Rancher、Longhorn、ArgoCD 都是 Helm 装的，参数化后一套 Chart 部署 dev/prod 两套环境。
- 【追问】
  - Q：Chart 里的模板怎么调试？A：`helm template` + `helm lint`，渲染错误会直接报错；复杂逻辑用 include 定义模板片段复用。
  - Q：Helm hook 是什么？A：templates 里带 annotations 标注 hook（pre-install、post-install、pre-delete 等）的资源，在 release 生命周期的指定时刻执行，比如 pre-install 跑个 Job 初始化数据库。
  - Q：CRD 放 crds/ 和 templates/ 的区别？A：crds/ 下的 CRD 不参与升级渲染、Helm 不管理其生命周期，适合装完就不动的；templates/ 里的 CRD 会被 Helm 管理（删除 release 时一起删）。
- 【岗位标注】DevOps

### Q15. HPA 的底层原理是什么？自定义指标怎么做？

- 【考察点】AI 运维岗会往深问：CPU 之外怎么扩缩容。
- 【参考回答】HPA 控制器通过 metrics API 读指标，标准链路是 metrics-server 暴露 resource metrics（CPU/内存），自定义指标走 custom metrics API（比如 Prometheus Adapter 把 Prometheus 里的业务指标暴露成 custom metrics）。控制器默认每 15 秒同步一次，按"期望副本数 = ceil(当前副本数 × 当前值 / 目标值)"计算，多个指标时取算出的最大副本数。还有两个关键行为：扩容没有冷却，但缩容默认等待 5 分钟（scaleDown stabilization window，K8s 1.27+ 默认 300s）防止抖动；以及 HPA 与 VPA（垂直扩缩容）的区别，HPA 加副本、VPA 调 requests，生产上常配合用。模型服务按 QPS 或推理队列长度扩缩容就是走 custom metrics 的典型场景。
- 【追问】
  - Q：HPA 计算时 currentReplicas 突然涨了怎么办？A：刚扩容完指标还没回落，HPA 会先等 Pod ready 再评估，有 status 里的 conditions 可以看（AbleToScale、ScalingActive、ScalingLimited）。
  - Q：maxReplicas 到了还扛不住怎么办？A：看 ScalingLimited condition，说明顶到上限了，要调 max 或优化服务本身，HPA 不是无限扩容的银弹。
- 【岗位标注】AI 运维 / DevOps

### Q16. etcd 怎么备份和恢复？你实际做过吗？

- 【考察点】运维岗的高频核心题，简历写了"3 控制节点"，etcd 必须能答出具体命令。
- 【参考回答】备份用 etcdctl 的 snapshot 命令，RKE2 里 etcdctl 在 /var/lib/rancher/rke2/bin/ 下，etcd 只监听 127.0.0.1:2379，所以要带证书。备份命令大概是：
  `ETCDCTL_ENDPOINTS=https://127.0.0.1:2379 ETCDCTL_CACERT=/var/lib/rancher/rke2/server/tls/etcd/server-ca.crt ETCDCTL_CERT=/var/lib/rancher/rke2/server/tls/etcd/server-client.crt ETCDCTL_KEY=/var/lib/rancher/rke2/server/tls/etcd/server-client.key /var/lib/rancher/rke2/bin/etcdctl snapshot save /backup/etcd-snapshot-$(date +%F).db`
  恢复流程：先停所有 server 节点，用 `rke2 server --cluster-reset --cluster-reset-restore-path=<快照路径>` 在单节点恢复，其余节点再重新 join，恢复后集群 ID 会变，需要重新同步 kubeconfig 和 Rancher agent。我项目里把这套备份做成了 CronJob/定时脚本，快照保留最近 N 份，存到独立位置。K3s 更省事，自带自动快照，默认每 12 小时存到 /var/lib/rancher/k3s/server/db/snapshots/。
- 【追问】
  - Q：只备份 etcd 够吗？A：etcd 存的是集群状态，业务数据在 PV 里，要分开备份；另外证书、kubeconfig 也要留底。
  - Q：3 节点 etcd 挂 1 个怎么处理？A：集群还能正常服务（多数派 2/3），先修复该节点让它重新加入；如果同一时间挂 2 个就只剩 1 个，失去多数派只读不写，必须用快照恢复。
  - Q：快照恢复后 Rancher 里集群状态会怎样？A：恢复的是历史时间点的集群状态，之后新增的对象会丢，Rancher 的 cluster agent 可能要重建，所以恢复前要确认恢复到哪个时间点、丢多少数据可接受。
- 【岗位标注】运维

**补充：原生 K8s 和 RKE2 备份、恢复 etcd 的流程有什么不同？**

两者本质上都是“给 etcd 做一致性快照”，但 **原生 K8s 没有内置自动备份机制，通常用 `etcdctl` 手动操作；RKE2 内置了 etcd 快照功能，默认就会定时生成快照**。

**原生 K8s（kubeadm / 静态 Pod etcd）**

**备份流程**

在 master 节点执行：

```bash
export ETCDCTL_API=3

etcdctl snapshot save /backup/etcd-snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

也可以从 etcd 静态 Pod 里执行：

```bash
kubectl -n kube-system exec -it etcd-<master> -- \
  etcdctl snapshot save /var/lib/etcd/snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

备份文件最好再同步到集群外，比如 S3 / MinIO / NFS。

**恢复流程**

1. 停止 kube-apiserver 和 etcd：

```bash
mv /etc/kubernetes/manifests /etc/kubernetes/manifests.bak
```

2. 清理旧数据：

```bash
mv /var/lib/etcd /var/lib/etcd.bak
```

3. 从快照恢复：

```bash
etcdctl snapshot restore /backup/etcd-snapshot.db \
  --data-dir=/var/lib/etcd
```

多节点集群恢复时，需要补上 `--name`、`--initial-cluster`、`--initial-advertise-peer-urls` 等参数。

4. 恢复静态 Pod：

```bash
mv /etc/kubernetes/manifests.bak /etc/kubernetes/manifests
```

5. 验证：

```bash
kubectl get nodes
etcdctl endpoint health
```

**RKE2**

**备份流程**

RKE2 默认会定时生成 etcd 快照，默认约 **12 小时一次**，保存在每个 server 节点上：

```text
/var/lib/rancher/rke2/server/db/snapshots
```

手动触发一次快照：

```bash
rke2 etcd-snapshot save --name pre-upgrade-snapshot
```

也可以配置定时策略和保留数量：

```yaml
etcd-snapshot-schedule-cron: "0 */6 * * *"
etcd-snapshot-retention: "6"
```

还可以直接配置 S3 备份，这样即使 etcd 节点全部丢失，也能从对象存储恢复。

**恢复流程**

1. 停止所有 server 节点上的 RKE2：

```bash
systemctl stop rke2-server
```

2. 在第一个 server 节点执行恢复：

```bash
rke2 server \
  --cluster-reset \
  --cluster-reset-restore-path=/var/lib/rancher/rke2/server/db/snapshots/etcd-snapshot-xxx.db
```

如果配置了 S3，可以只传快照文件名，RKE2 会从 S3 拉取。

3. 恢复完成后启动第一个节点：

```bash
systemctl start rke2-server
```

4. 其他 server 节点清理旧 etcd 数据：

```bash
rm -rf /var/lib/rancher/rke2/server/db
systemctl start rke2-server
```

5. 验证集群：

```bash
kubectl get nodes
```

**关键区别**

| 对比项 | 原生 K8s | RKE2 |
| --- | --- | --- |
| 备份方式 | 手动 `etcdctl snapshot save` | 内置自动快照，也可手动触发 |
| 备份路径 | 自己指定 | `/var/lib/rancher/rke2/server/db/snapshots` |
| 定时备份 | 需自己写 cron / Job | 默认开启，可配 cron |
| 恢复方式 | `etcdctl snapshot restore` + 重建静态 Pod | `rke2 server --cluster-reset --cluster-reset-restore-path` |
| S3 备份 | 需自己接 sidecar / 脚本 | 原生支持 S3 配置 |
| 多节点恢复 | 需手动处理 member / initial-cluster | RKE2 自动重置 etcd 成员关系 |

简单记： **原生 K8s 靠 `etcdctl`，RKE2 靠 `rke2 etcd-snapshot` + `--cluster-reset`。**

---

RKE2 配置 S3 快照备份那部分，需要我展开说说具体怎么配吗？

K8s高可用集群升级&etcd备份

### Q17. RKE2 和原生 K8S 有什么异同？

RKE2 本质上还是 **标准 Kubernetes**，API、对象模型、kubectl 用法、CNI/CSI/Ingress 插件生态都和原生 K8s 一致；差别主要在 **安装方式、控制平面形态、默认安全策略、容器运行时和运维模型**。

**相同点**

- **都是 CNCF 认证 Kubernetes**：RKE2 是完全兼容的 Kubernetes 发行版，不会改变你写 Deployment、Service、Ingress、Helm Chart 的方式。
- **控制平面组件相同**：都有 API Server、Controller Manager、Scheduler、etcd、kubelet、kube-proxy、CoreDNS 等。
- **工作负载可移植**：给原生 K8s 写的 YAML、Operator、CRD、Helm Chart，通常可以直接在 RKE2 上跑。
- **集群能力相同**：RBAC、Namespace、NetworkPolicy、HPA、StatefulSet、DaemonSet、Job、CronJob 等都一样。

**主要差异**

| 维度 | 原生 Kubernetes | RKE2 |
| --- | --- | --- |
| 定位 | 上游项目，需要自己组装组件 | Rancher 的企业级发行版，强调安全合规 |
| 安装方式 | kubeadm/kubespray/二进制手工部署 | 单二进制 + systemd 服务，脚本或 Rancher 安装 |
| 控制平面 | 通常由 kubeadm 管理为 systemd 服务/静态 Pod | 控制平面组件以 **kubelet 管理的静态 Pod** 运行 |
| 容器运行时 | 可选 containerd / CRI-O 等 | 默认内置 **containerd**，不依赖 Docker |
| 数据存储 | 通常外部 etcd | 默认 **嵌入式 etcd** |
| 安全默认值 | 需要手动加固 | 默认更贴近 **CIS Benchmark**，支持 FIPS |
| 组件来源 | 需分别安装、升级、配置 | 从 RKE2 runtime 镜像/包中统一提供 |
| 升级方式 | kubeadm upgrade 或手工升级 | RKE2 版本升级、Rancher 托管升级 |
| 运维复杂度 | 灵活，但需要更多手工配置 | 更“打包化”，适合标准化生产集群 |

**关键区别：RKE2 不是“另一个 K8s”，而是“打包更完整的 K8s”**

原生 K8s 更像一个基础平台：你选 kubeadm、containerd、CNI、Ingress、etcd、证书管理、升级流程，然后自己拼装。

RKE2 则把这些东西打包好了：

- 内置 containerd；
- 内置 etcd；
- 控制平面用静态 Pod 管理；
- 默认提供 Canal/Calico/Flannel/Cilium 等 CNI 能力；
- 默认集成 CoreDNS、Metrics Server、NGINX Ingress、Helm Controller 等组件；
- 默认更靠近 CIS 安全基线。

所以你在 RKE2 里看到的 `kubectl get nodes`、`kubectl get pods -n kube-system`、`kubectl apply -f`，和原生 K8s 几乎没有区别。

**什么时候选 RKE2？**

适合选 RKE2 的场景：

- 想快速搭建生产级 K8s 集群；
- 不想自己维护 kubeadm、containerd、etcd、CNI、证书轮换；
- 需要 CIS 加固、FIPS、离线部署、企业合规；
- 后续可能用 Rancher 管理多集群。

适合继续用原生 K8s 的场景：

- 团队已经有成熟的 kubeadm/kubespray 运维体系；
- 需要高度自定义控制平面、etcd、CNI、升级流程；
- 不想依赖特定发行版或供应商；
- 希望完全按上游文档排查问题。

**一句话总结**

**原生 K8s 是“裸平台”，RKE2 是“加固版、打包版、运维友好版”的标准 Kubernetes。**

如果你只是跑业务，RKE2 和原生 K8s 用起来几乎一样；差别更多体现在安装、升级、安全默认值和底层组件管理上。

### Q18. RKE2 对 etcd 是怎么管理的？

RKE2 对 etcd 的管理可以概括成一句话： **嵌入式 etcd + 静态 Pod 管理 + 内置快照 + 自动证书轮换**。

**1. etcd 是“嵌入”的，但不是单独装一个 etcd 包**

RKE2 的 etcd 数据目录默认在：

```text
/var/lib/rancher/rke2/server/db/etcd
```

它由 `rke2-server` 进程管理，etcd 本身作为控制平面组件，以 **kubelet 管理的静态 Pod** 运行。

这意味着你不需要像原生 K8s 那样：

- 单独安装 etcd；
- 手写 `etcd.yaml` 静态 Pod；
- 手动管理 etcd 证书；
- 自己处理 etcd 成员变更。

**2. 高可用：Server 节点自动组成 etcd 集群**

生产 HA 集群通常部署 3 或 5 个 RKE2 Server 节点，它们会同时承担 **control plane + etcd** 角色。

加入方式很简单：新 Server 节点配置里写上：

```yaml
server: https://<首个server节点IP>:9345
token: <集群token>
```

RKE2 会自动把它加入 etcd 集群。

注意：etcd 节点数建议是奇数，3、5 比较常见，避免 Quorum 问题。

**3. 备份：内置 etcd 快照**

RKE2 默认会定期创建 etcd 快照，默认每 12 小时一次，快照保存在：

```text
/var/lib/rancher/rke2/server/db/snapshots
```

你也可以手动触发：

```bash
rke2 etcd-snapshot save --name pre-upgrade-snapshot
```

快照可以存本地，也可以配置 S3。

**4. 恢复：用 `--cluster-reset` 恢复快照**

恢复时通常要：

```bash
systemctl stop rke2-server

rke2 server \
  --cluster-reset \
  --cluster-reset-restore-path=/var/lib/rancher/rke2/server/db/snapshots/xxx

systemctl start rke2-server
```

如果是多 Server 集群，恢复后其他 Server 节点通常需要清理旧 etcd 数据目录，再重新加入。

**5. 成员变更：不建议手动操作 etcdctl**

原生 K8s 里，etcd 成员变更常用 `etcdctl member add/remove`。

RKE2 里更推荐通过 RKE2/Rancher 管理 Server 节点加入或移除，让 RKE2 自动处理 etcd 成员关系。手动改 etcd 成员容易和 RKE2 的引导数据不一致。

**6. 证书：自动轮换**

RKE2 会自动轮换 etcd 和控制平面证书，不需要像 kubeadm 那样经常手动 `kubeadm alpha certs renew`。

**和原生 K8s 的主要区别**

| 能力 | 原生 K8s | RKE2 |
| --- | --- | --- |
| etcd 部署 | kubeadm 静态 Pod 或外部 etcd | 嵌入式 etcd，由 rke2-server 管理 |
| 快照备份 | 需自己用 `etcdctl` | 内置 `rke2 etcd-snapshot` |
| 恢复流程 | 手动 restore + 重建成员 | `--cluster-reset --cluster-reset-restore-path` |
| 成员管理 | `etcdctl member` | 通过加入/移除 Server 节点自动管理 |
| 证书轮换 | 需手动或自建自动化 | 默认自动轮换 |

生产上最关键的是： **一定要开启定期快照，并把快照同步到 S3 或集群外存储**。否则所有 etcd 节点同时故障时，本地快照也会一起丢失。

---

需要说说怎么配置 RKE2 把 etcd 快照自动同步到 S3 吗？本地快照在多台 Server 同时故障时保护不了数据。

### Q19. ClusterRole + RoleBinding 的组合是怎么工作的？

你的理解 **方向基本对，但有一处要纠正**：

**RoleBinding 不是“定义角色”，而是“把角色绑定到用户 / 组 / ServiceAccount”。**

真正“定义角色”的是 **Role** 或 **ClusterRole**。

更准确的说法是：

```text
ClusterRole：定义一组权限（能做什么）
RoleBinding：指定命名空间，并把这组权限绑定到某个主体
最终效果：该主体在指定命名空间里拥有这些权限
```

**举个例子**

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-reader
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: dev
subjects:
  - kind: ServiceAccount
    name: dev-sa
    namespace: dev
roleRef:
  kind: ClusterRole
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

这里：

- `ClusterRole` 定义了“可以 get/list/watch pods”；
- `RoleBinding` 把这个权限绑定到 `dev` 命名空间里的 `dev-sa`；
- 所以 `dev-sa` **只能在 `dev` 命名空间里读 Pod**，不能跨到其他 namespace。

**四个对象的关系**

| 对象 | 作用 | 范围 |
| --- | --- | --- |
| **Role** | 定义命名空间内权限 | 命名空间 |
| **ClusterRole** | 定义集群级权限模板 | 集群 |
| **RoleBinding** | 把 Role/ClusterRole 绑定到主体 | 命名空间 |
| **ClusterRoleBinding** | 把 ClusterRole 绑定到主体 | 集群 |

**关键组合**

- **Role + RoleBinding**：权限只在某个 namespace 内生效。
- **ClusterRole + ClusterRoleBinding**：权限在整个集群生效。
- **ClusterRole + RoleBinding**：权限只在该 RoleBinding 的 namespace 内生效。这是复用权限模板的常用方式。

所以可以记成： **ClusterRole 负责“有什么权限”，RoleBinding 负责“谁在哪个命名空间里能用这些权限”。**

### Q20. dev-sa 是指一个用户吗？

`dev-sa` 不是人用的用户账号，而是一个 **ServiceAccount，也就是服务账号**。

Kubernetes 里有两类“用户”：

| 类型 | 面向谁 | 作用范围 | 管理方式 |
| --- | --- | --- | --- |
| **User** | 人，比如运维、开发 | 集群全局 | 通常由外部系统管理，K8s 里没有 `User` 这个 API 对象 |
| **ServiceAccount** | Pod 里的进程 | 命名空间级别 | K8s API 对象，可以用 `kubectl` 创建 |

所以前面例子里的 `dev-sa`，代表的是 **`dev` 命名空间里的某个应用 Pod 的身份**，而不是某个开发人员。

```yaml
subjects:
  - kind: ServiceAccount
    name: dev-sa
    namespace: dev
```

这段意思是：把权限授予 `dev` 命名空间下的 ServiceAccount `dev-sa`。如果某个 Pod 使用这个 ServiceAccount 运行，它就能拥有对应权限。

如果要把权限授予一个真实的人，应该写成：

```yaml
subjects:
  - kind: User
    name: alice
    apiGroup: rbac.authorization.k8s.io
```

简单记： **User 是给人用的，ServiceAccount 是给 Pod 用的。**

### Q21. 什么情况下 Pod 会用到 ServiceAccount？

其实 **所有 Pod 都会关联一个 ServiceAccount**，只是你感不感知得到。

如果你不显式指定，Kubernetes 会自动把当前命名空间里的 `default` ServiceAccount 分配给这个 Pod。

但“关联 SA”不等于“要用它”。Pod 真正 **用到** ServiceAccount，通常是下面几类场景：

**1. Pod 需要访问 Kubernetes API**

这是最常见、也最核心的场景。

比如 Pod 里的程序要：

- 读取 Secret；
- 列出 Pod；
- 查看 Deployment 状态；
- 创建 ConfigMap；
- 调用 API Server 做服务发现；
- 使用 client-go 写 Operator 或 Controller。

这时 Pod 需要访问 API Server，而访问凭据就来自它关联的 ServiceAccount。

默认情况下，这个 token 会挂载到容器里：

```text
/var/run/secrets/kubernetes.io/serviceaccount/
```

Pod 里的程序可以用这个 token 向 API Server 认证。

**2. 使用云厂商或外部服务时做身份标识**

有些场景下，ServiceAccount 会被当作 Pod 的身份标识：

- 访问云厂商 API；
- 使用 OIDC/IAM 集成；
- CI/CD 流水线里的 Job Pod 需要认证到集群；
- 第三方安全工具根据 SA 识别 Pod 身份。

**3. 拉取私有镜像**

ServiceAccount 可以配置 `imagePullSecrets`。

如果 Pod 要从私有镜像仓库拉镜像，可以通过 SA 关联的 Secret 完成认证。

**4. 需要给 Pod 做最小权限控制**

即使 Pod 暂时不调用 API Server，生产上也建议：

- 为应用单独创建 ServiceAccount；
- 通过 RBAC 只授予它真正需要的权限；
- 避免所有 Pod 都共用权限过大的 `default` SA。

**5. 不需要访问 API 时，可以关闭自动挂载**

如果 Pod 只是跑一个普通 Web 服务，完全不需要访问 API Server，可以关闭自动挂载：

```yaml
spec:
  serviceAccountName: my-app-sa
  automountServiceAccountToken: false
```

这样容器里就不会自动出现 API token，减少不必要的攻击面。

**一句话总结**

**所有 Pod 都有一个 ServiceAccount；只有当 Pod 需要访问 API Server、访问外部服务、拉私有镜像，或需要精细权限控制时，才会真正“用到”它。**

### Q22. RBAC 是"基于用户"的权限配置吗？

这种说法 **对了一半**。RBAC 确实常被用来给不同身份的人分配不同权限，但它不是只给“人”用的。

更准确地说： **RBAC 是基于“身份主体”的权限控制**。这个主体可以是三类：

| 主体 | 面向谁 | 例子 |
| --- | --- | --- |
| **User** | 人 | 运维、开发、管理员 |
| **Group** | 用户组 | dev-team、sre-team |
| **ServiceAccount** | Pod / 程序 | Prometheus、ArgoCD、应用 Pod |

**为什么大家常说“基于用户”？**

因为日常运维里，RBAC 最常见的用途就是：

- 让开发只能看 `dev` 命名空间；
- 让运维能管理节点；
- 让管理员拥有 `cluster-admin`；
- 让某个外部用户只能通过 kubeconfig 访问集群。

这些场景里，主体确实是“人”，所以大家会简化成“RBAC 是给不同用户分配不同权限”。

**但 RBAC 也管 Pod 的权限**

前面说的 `dev-sa` 就是典型例子。Pod 里的程序如果要访问 API Server，它需要一个身份，这个身份就是 ServiceAccount。然后通过 RBAC 给它授权：

```yaml
subjects:
  - kind: ServiceAccount
    name: dev-sa
    namespace: dev
```

这样，`dev-sa` 对应的 Pod 就能拥有 Role/ClusterRole 里定义的权限。

**还有一个容易忽略的点**

Kubernetes 里其实没有 `User` 这个 API 对象。User 通常来自外部系统，比如证书里的 CN、OIDC 身份提供方、企业账号系统。K8s 只是把这个用户名当作一个字符串，再交给 RBAC 判断有没有权限。

而 ServiceAccount 是真正的 K8s API 对象，可以用 `kubectl get sa` 看到。

**一句话总结**

**RBAC 不是只控制“人”，而是控制“谁”。这个“谁”可以是人、用户组，也可以是 Pod 里的 ServiceAccount。**

说它“基于用户”只是日常简化说法，完整说法应该是“基于角色的访问控制，主体包括 User、Group 和 ServiceAccount”。

### Q23. 蓝绿部署和金丝雀发布在 K8s 里分别怎么配置？

蓝绿和金丝雀在 K8s 里有两条主流实现路径： **原生 Service/Ingress 手工控制**，或者用 **Argo Rollouts 自动化管理**。下面分别说。

**一、蓝绿部署**

**核心思路**

蓝绿发布是零停机策略，核心是同时维护两套环境（蓝=旧版本，绿=新版本），先部署绿环境并验证，验证通过后将流量从蓝切到绿，最后销毁蓝环境。蓝、绿使用独立的 Deployment，但共享同一个 Service，通过标签选择器控制流量指向；若绿环境异常，只需把 Service 的 selector 切回蓝环境标签即可快速回滚。

**原生配置方式**

**1. 蓝环境 Deployment**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
      version: v1
  template:
    metadata:
      labels:
        app: myapp
        version: v1
    spec:
      containers:
        - name: myapp
          image: app:v1
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
```

**2. Service 初始指向蓝**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  type: ClusterIP
  selector:
    app: myapp
    version: v1   # 初始指向蓝环境
  ports:
    - port: 80
      targetPort: 8080
```

**3. 部署绿环境并切流**

部署 v2 后，即使所有 Pod 都 Ready，K8s 也不会把流量发给 v2，因为 Service 的 selector 只匹配 v1。确认一切正常后，用 `kubectl patch service` 修改 selector 把流量导向 v2；如果运行一段时间后发现问题，再把 selector 改回 v1 即可回滚。

```bash
kubectl apply -f app-v2.yaml
# 验证绿环境
kubectl port-forward svc/myapp-service 8080:80
# 切流
kubectl patch service myapp-service -p '{"spec":{"selector":{"version":"v2"}}}'
# 回滚
kubectl patch service myapp-service -p '{"spec":{"selector":{"version":"v1"}}}'
```

**Argo Rollouts 的蓝绿配置**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: bluegreen-demo
spec:
  replicas: 5
  selector:
    matchLabels:
      app: bluegreen-demo
  template:
    metadata:
      labels:
        app: bluegreen-demo
    spec:
      containers:
        - name: app
          image: my-app:v1
          ports:
            - containerPort: 8080
  strategy:
    blueGreen:
      activeService: bluegreen-active     # 当前活跃 Service
      previewService: bluegreen-preview   # 预览 Service
      autoPromotionEnabled: false         # 手动切换
      scaleDownDelaySeconds: 30           # 旧版本延迟销毁
      scaleDownDelayRevisionLimit: 2      # 保留历史版本数
```

需要同时准备 active 和 preview 两个 Service。新版本启动后 preview Service 指向 v2，active Service 仍指向 v1，生产流量不受影响；可以先 port-forward 到 preview 手动验证，确认无误后用 `kubectl argo rollouts promote` 切换 active。

**二、金丝雀发布**

**方式一：Nginx Ingress 注解（轻量，无需额外组件）**

关键注解包括 `nginx.ingress.kubernetes.io/canary: "true"`（启用灰度）、`nginx.ingress.kubernetes.io/canary-weight: "0-100"`（按权重切分流量）、`canary-by-header` 及 `canary-by-header-value`（基于请求头匹配）、`canary-by-cookie`（基于 Cookie 匹配），规则优先级为 Header > Cookie > Weight。

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"   # 10% 流量到新版本
spec:
  rules:
    - host: my-app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app-v2
                port:
                  number: 80
```

逐步调整权重即可推进：初始 10%，验证通过后调到 50%，最终 100% 完成全量；发现问题时把 `canary-weight` 设为 0，所有流量切回旧版本。

如果想做定向灰度，可以用请求头匹配：`nginx.ingress.kubernetes.io/canary-by-header: "X-Canary"` 配合 `canary-by-header-value: "true"`，把带特定请求头的流量路由到新版本。

**方式二：Argo Rollouts（适合需要自动判断的场景）**

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: ingress-canary
spec:
  replicas: 10
  selector:
    matchLabels:
      app: ingress-canary
  template:
    metadata:
      labels:
        app: ingress-canary
    spec:
      containers:
        - name: app
          image: my-app:v1
          ports:
            - containerPort: 8080
  strategy:
    canary:
      trafficRouting:
        nginx:
          stableIngress: app-stable   # 稳定版 Ingress
      steps:
        - setWeight: 10
        - pause: { duration: 2m }
        - setWeight: 30
        - pause: { duration: 5m }
        - setWeight: 50
        - pause: { duration: 5m }
        - setWeight: 100
```

金丝雀 Ingress 由 Rollout 自动管理，不需要手动创建。

**配合 Analysis 做自动判断**

AnalysisTemplate 定义指标查询指令、阈值及成功/失败条件，AnalysisRun 是其运行时实例。Rollout 通过 `strategy.canary.analysis` 引用 AnalysisTemplate，可用 `startingStep` 指定分析开始的步骤；指标满足成功条件则继续发布，满足失败条件则自动回滚，无法判定则暂停发布。

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      interval: 1m
      count: 3
      successCondition: result[0] >= 0.95
      failureCondition: result[0] < 0.90
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{service="{{args.service-name}}",code!~"5.."}[2m]))
            /
            sum(rate(http_requests_total{service="{{args.service-name}}"}[2m]))
```

后台持续分析可以这样配：在 `strategy.canary.analysis` 中设置 `startingStep: 1`，表示从第 2 步开始后台持续分析，整个发布过程中会不断检查指标，任何一次失败都会触发回滚。

**三、两者怎么选**

| 发布模式 | 流量比例 | 回滚速度 | 适用场景 |
| --- | --- | --- | --- |
| 金丝雀（Canary） | 渐进 5%→100% | 快（可自动） | 生产标准发布 |
| 蓝绿（BlueGreen） | 0%→100% 切换 | 最快（切 Service） | 大版本升级 |
| 金丝雀 + Analysis | 渐进 + 指标判断 | 最快（自动回滚） | 高可用要求场景 |

蓝绿的一个明显代价是资源：蓝绿部署某一时刻只有一个环境对外提供服务，另一环境处于待命状态，缺点是一套环境空跑，存在资源浪费。所以资源紧张时优先金丝雀，大版本升级、新旧差异大且需要快速回滚时才用蓝绿。

另外提醒一点，如果用 ArgoCD 做 GitOps，`selfHeal: true` 时手动的 promote/abort 操作可能被 ArgoCD 覆盖，建议在渐进式发布期间设置 `selfHeal: false` 或使用 SkipReconcile 注解。

### Q24. 探针在生产上的最佳实践？说说你实际配过的参数。

- 【考察点】探针进阶：背参数容易，讲"为什么这么配"才算会，运维/AI 运维高概率追问。
- 【追问】
  - Q：liveness 误杀的真实案例？A：老版本很多人在 initialDelaySeconds 设 10 秒，Java 应用启动要 60 秒，10 秒后第一次探测失败、3 次失败被杀，无限重启——后来统一改成 startupProbe 方案。
  - Q：探针失败对流量有什么影响？A：readiness 失败立即从 Service endpoints 摘除，现有连接还在，新流量不再进来，所以配合优雅停机（preStop hook 加 sleep）能实现平滑发布。
- 【岗位标注】运维 / AI 运维

---

**补充：minReadySeconds、preStop、terminationGracePeriodSeconds 分别确保什么？**

这三个参数分别管的是： **新 Pod 别太快接流量、旧 Pod 别立刻被杀、被杀时要留够收尾时间**。

**三个参数的分工**

| 参数 | 管什么 | 确保什么 |
| --- | --- | --- |
| `minReadySeconds` | Pod 通过 `readinessProbe` 后，还要“稳多久”才算可用 | 防止 Pod 刚 Ready 就立刻接入流量，减少闪断 |
| `preStop` | Pod 被删除前执行一段收尾动作 | 让 Pod 主动摘流、等存量请求处理完，再真正退出 |
| `terminationGracePeriodSeconds` | Pod 从开始终止到被强制杀掉的最大时间 | 保证 preStop + 应用优雅关闭有足够时间，超时会被 SIGKILL 强杀 |

**`minReadySeconds`：防止新 Pod 过早接流量**

`readinessProbe` 通过只代表 Pod 已经 Ready，但有些应用还需要一点时间预热，比如连接池、缓存、路由表还没完全稳定。

`minReadySeconds` 的作用就是：Pod 进入 Ready 后，还要持续保持 Ready 至少这么多秒，Deployment 才会认为它真正可用。

比如：

```yaml
minReadySeconds: 30
```

表示新 Pod 通过就绪探针后，还要再稳定 30 秒，才允许继续替换下一个旧 Pod。

**`preStop`：让旧 Pod 优雅摘流**

`preStop` 是容器终止前执行的生命周期钩子。

常见用途：

- 主动关闭端口，让 `readinessProbe` 失败；
- 调用应用 `/shutdown` 接口；
- `sleep` 几秒，等负载均衡器、Endpoints、iptables/IPVS 规则同步完成；
- 等待存量请求处理完。

例如：

```yaml
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 10"]
```

注意，`preStop` 是同步执行的，Kubelet 会等它执行完才会继续发 SIGTERM。

**`terminationGracePeriodSeconds`：给优雅退出留总时间**

`terminationGracePeriodSeconds` 是 Pod 被终止后的总宽限时间，默认 30 秒。

它覆盖的是整个终止窗口：

```text
Pod 被标记为 Terminating
  → 执行 preStop
  → 发送 SIGTERM
  → 应用处理存量请求、释放资源
  → 超过 terminationGracePeriodSeconds 仍未退出 → SIGKILL 强杀
```

所以它必须大于：

```text
preStop 执行时间 + 应用优雅关闭时间
```

如果设得太短，preStop 还没跑完，或者应用还没处理完请求，Pod 就会被 SIGKILL 强制杀掉，可能出现 502、请求超时、数据不一致。

**它们和 readinessProbe 怎么配合**

可以把滚动更新理解成一条时序链：

```text
新 Pod 启动
  → readinessProbe 通过
  → minReadySeconds 观察稳定
  → 新 Pod 正式接入流量

旧 Pod 开始终止
  → preStop 摘流、等存量请求
  → SIGTERM 通知应用优雅关闭
  → terminationGracePeriodSeconds 内退出
  → 超时则 SIGKILL 强杀
```

一个比较稳妥的配置示例：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  minReadySeconds: 30
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 0
      maxUnavailable: 1
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
        - name: app
          image: my-app:latest
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["sh", "-c", "sleep 10"]
```

这里：

- `readinessProbe` 保证新 Pod 能正常服务；
- `minReadySeconds: 30` 防止刚 Ready 就接流量；
- `preStop: sleep 10` 留出摘流和规则同步时间；
- `terminationGracePeriodSeconds: 60` 保证 preStop 和应用关闭不会被打断。

简单记就是： **`readinessProbe` 管“什么时候接流量”，`minReadySeconds` 管“接流量后稳不稳”，`preStop` 管“怎么优雅摘流”，`terminationGracePeriodSeconds` 管“优雅退出有没有足够时间”。**

**补充：preStop 只配 sleep 10 就能保证 Pod 退出前把流量摘干净吗？**

> lifecycle:
> preStop:
> exec:
> command: ["sh", "-c", "sleep 10"]
>
> ---
>
> 这一段配置就能保证pod 在推出前就能把流量摘干净吗？

**不能保证 100% 摘干净，但它是目前最实用的“兜底缓冲”**。`preStop: sleep 10` 的核心作用是给 **Endpoints 摘流、kube-proxy 更新 iptables/ipvs、Ingress/ALB 同步后端组** 留出传播时间，避免 Pod 在流量规则还没生效时就被 SIGTERM 杀掉。

**为什么它不能“保证”**

- **摘流和终止是并发的**：Pod 被标记为 Terminating 后，Endpoint 摘流和 preStop 执行是两条并行线，K8s 不保证谁先完成。
- **sleep 期间 Pod 仍在收流量**：`preStop` 执行时 Pod 还活着，如果负载均衡器或 kube-proxy 规则还没同步完，新请求仍可能打到这个 Pod。
- **只解决“摘流延迟”，不管“在途请求”**：`sleep` 只是等规则生效，存量请求的完整处理要靠 SIGTERM 后应用自己的优雅关闭逻辑。
- **Ingress 层是独立延迟**：即使 kube-proxy 规则更新了，ALB/Nginx Ingress 的后端组同步也是独立的，sleep 10 不一定够。

**更稳妥的组合打法**

| 层次 | 配置 | 作用 |
| --- | --- | --- |
| **流量摘除** | `readinessProbe` + `failureThreshold: 1` | 让 Pod 尽快从 Endpoints 中移除，加速摘流 |
| **规则传播缓冲** | `preStop: sleep 5~10` | 等 kube-proxy/Ingress 规则同步完成 |
| **应用优雅关闭** | 应用捕获 SIGTERM，停止接新请求、处理在途请求 | 真正处理存量请求，不丢业务状态 |
| **总时间兜底** | `terminationGracePeriodSeconds ≥ preStop + 应用关闭时间` | 防止被 SIGKILL 强杀 |

**一个更完整的示例**

```yaml
spec:
  terminationGracePeriodSeconds: 60   # 必须 ≥ preStop + 应用关闭时间
  containers:
    - name: app
      image: my-app:latest
      readinessProbe:
        httpGet:
          path: /healthz
          port: 8080
        periodSeconds: 3
        failureThreshold: 1           # 加速摘流
      lifecycle:
        preStop:
          exec:
            command: ["sh", "-c", "sleep 10"]
```

**一句话总结**

`preStop: sleep 10` **不能单独保证** 流量摘干净，它解决的是“摘流规则传播延迟”这个时间窗口。真正零中断需要四层配合： **readinessProbe 主动摘流 → preStop 等规则生效 → SIGTERM 后应用优雅关闭 → terminationGracePeriodSeconds 兜底不被强杀**。

如果你的业务对丢请求特别敏感（比如下单、支付），还需要在业务层做 **幂等键** 和 **重试恢复**，因为再完善的优雅停机也挡不住客户端超时重试带来的重复请求。
