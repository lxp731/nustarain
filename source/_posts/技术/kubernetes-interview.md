---
title: Kubernetes 面试问答（34 题）
date: 2026-08-27 09:10:00
categories: 技术
tags:
  - K8S
  - 面试

---

本文整理了Kubernetes 面试问答（34 题）相关的 34 个高频面试问题，从基础到进阶再到生产实战层层递进，覆盖K8S、面试等核心考点，每题附参考回答与追问，适合面试前系统复习。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

---

## 一、岗位高频速查

| 岗位 | 必考问题（一句话要点） |
| --- | --- |
| 运维工程师 | ① etcd 怎么备份/恢复（`etcdctl snapshot save` + `--cluster-reset-restore-path`）；② 节点 NotReady 排查（kubelet 状态 → 证书有效期 → 磁盘空间）；③ Pod Pending/CrashLoopBackOff 排障流程（describe → logs → events）；④ RKE2 3+5 集群初始化细节（config.yaml、token、join、证书）；⑤ Longhorn 日常运维（副本数、drain 卡住、磁盘满） |
| 技术支持工程师 | ① Pod 各状态含义（Pending/Running/CrashLoopBackOff/ImagePullBackOff）；② kubectl 排障三板斧（`describe`/`logs`/`get events`）；③ Service 访问不通排查链路（svc → endpoints → pod → 节点）；④ 基础概念（Deployment/PVC/ConfigMap/探针）；⑤ 深度原理问得少，重点看排查思路是否清晰、能不能把话说清楚 |
| AI 运维工程师 | ① 有状态服务持久化（StatefulSet + Longhorn 动态供给，向量库/数据库容器化）；② 探针配置（模型加载慢 → startupProbe 防误杀）；③ HPA 与资源配额（metrics-server、requests/limits 怎么定）；④ Job/CronJob 跑批处理（embedding 流水线、定时任务）；⑤ CoreDNS/网络排查（微服务互相调用不通） |
| DevOps 工程师 | ① Helm Chart 结构（Chart.yaml/values/templates、升级回滚）；② GitOps（ArgoCD sync/prune/selfHeal、cert-manager 证书）；③ 滚动更新与回滚（maxSurge/maxUnavailable、`rollout undo`）；④ RBAC 与多环境隔离（namespace、ResourceQuota）；⑤ 镜像与 CI/CD（Harbor 私有仓库、离线环境拉镜像） |

---

## 二、基础篇

### Q1. Kubernetes 是什么？核心组件有哪些，各自负责什么？

- 【考察点】考察是否真正理解 K8s 架构，而不是只会敲命令。能不能分清控制面组件和数据面组件。
- 【参考回答】K8s 是一套容器编排平台，核心思想是"声明式 + 控制器不断把实际状态收敛到期望状态"。控制面有四个组件：kube-apiserver 是唯一入口，所有请求都走它，负责认证鉴权和读写 etcd；etcd 是键值数据库，存所有集群状态，是唯一有状态、必须备份的东西；kube-controller-manager 跑各种控制器，比如 Node 控制器、Deployment 控制器；kube-scheduler 负责把 Pod 调度到合适的节点。数据面在节点上：kubelet 是节点上的代理，负责管理本节点 Pod 生命周期，向 apiserver 汇报；kube-proxy 实现 Service 的负载均衡转发，默认 iptables 模式。我搭的 RKE2 集群里，控制节点同时跑 apiserver、etcd、controller-manager、scheduler 这四个，工作节点只跑 kubelet 和 kube-proxy，再加上 CNI 网络插件。
- 【追问】
  - Q：etcd 挂了会发生什么？A：apiserver 读不到状态，整个集群的写请求全部失败，kubectl get 也会超时。但已运行的 Pod 不会立刻挂，kubelet 还在本地管理容器，只是集群"失明"了，所以 etcd 必须做备份。
  - Q：kubelet 和 kube-proxy 挂了的区别？A：kubelet 挂了，节点上 Pod 没人管，节点会被标记 NotReady，Pod 被驱逐；kube-proxy 挂了，节点上的 Service 转发规则失效，但 Pod 本身正常。
  - Q：apiserver 为什么要做高可用？A：所有组件和 kubectl 都依赖它，单点挂了整个集群不可控。我那个 3 控制节点集群，就是 3 个 apiserver + 3 节点 etcd，前面再放负载均衡入口。
- 【岗位标注】通用 / 运维 / 技术支持

### Q2. 什么是 Pod？Pod 有哪些生命周期状态？

- 【考察点】Pod 是 K8s 最小调度单位，状态是排障基础，几乎必问。
- 【参考回答】Pod 是最小部署单元，一个 Pod 里可以有一个或多个容器，共享网络命名空间和存储卷，所以同 Pod 容器用 localhost 就能互通。生命周期分几个阶段：Pending 是还没被调度成功或者镜像还没拉完；Running 是至少一个容器在运行；Succeeded 是任务类 Pod 正常跑完；Failed 是异常退出；Unknown 是 kubelet 失联。注意阶段和容器状态是两回事——比如 CrashLoopBackOff 其实是容器状态 Waiting 下的一个 reason，不是 Pod 阶段。排障第一步永远是 `kubectl describe pod` 看 Events，比猜快得多。
- 【追问】
  - Q：Pending 了但 describe 看不到明显报错怎么办？A：看 `kubectl get events --sort-by=.lastTimestamp`，或者看 `kubectl describe node` 确认节点资源，调度事件在 node 上也可能有记录。
  - Q：一个 Pod 里什么时候放多个容器？A：强耦合、必须同生命周期、同网络同存储的场景，比如边车容器做日志采集、代理；业务上独立扩展的应该拆成多个 Pod。
  - Q：Pod 被删了会怎么样？A：要看有没有控制器管它。Deployment 管的会立即重建，裸 Pod 删了就没了——这也是为什么生产上不应该裸建 Pod。
- 【岗位标注】通用 / 技术支持

### Q3. Deployment、ReplicaSet 是什么关系？滚动更新怎么做、怎么回滚？

- 【考察点】控制器模型与滚动更新是 K8s 核心操作，DevOps 岗必问细节。
- 【参考回答】Deployment 管理 ReplicaSet，ReplicaSet 管理 Pod 副本数，三层结构。滚动更新时 Deployment 会创建新的 ReplicaSet，新 RS 的 Pod 一个个起来、旧 RS 的 Pod 一个个删掉，期间旧版本 Pod 还能提供服务，所以能做到零停机。更新策略由 maxSurge 和 maxUnavailable 控制，默认各 25%。回滚用 `kubectl rollout undo deployment/nginx`，可以 `--to-revision=2` 回指定版本，历史版本默认保留 10 个（revisionHistoryLimit）。我生产上发布失败，第一反应就是 `kubectl rollout status deployment/xxx` 看卡在哪，再 `rollout undo` 快速止血。
- 【追问】
  - Q：maxSurge=0、maxUnavailable=1 和默认 25% 有什么区别？A：maxUnavailable=1 意味着先删一个旧的再起新的，适合资源紧张但想要快速回滚的场景；默认 25% 是"多起 25%、少停 25%"，更平滑但瞬时资源占用高。
  - Q：怎么暂停滚动更新？A：`kubectl rollout pause deployment/xxx`，用于多阶段发布（比如先改镜像再改配置，分两次触发但只滚一次）。
  - Q：为什么更新后 Pod 版本没变？A：最常见是镜像 tag 用了 latest 且 imagePullPolicy 不是 Always，或者模板根本没变，Deployment 认为没有变更就不会触发新 RS。
- 【岗位标注】通用 / DevOps

### Q4. Service 有哪几种类型？和 Ingress 什么区别？

- 【考察点】网络暴露链路是面试必考，也是排障高频场景。
- 【参考回答】Service 是四层负载均衡抽象，有稳定 IP 和 DNS 名。ClusterIP 只在集群内访问，是默认类型；NodePort 在每个节点开一个 30000-32767 的端口转发到 Service；LoadBalancer 需要云厂商或裸金属的负载均衡器（比如 metallb）配合，底层其实还是 NodePort + 外部 LB；还有 ExternalName 做 DNS 别名。Ingress 是七层的，按域名和路径路由到 Service，一个 Ingress 可以管多个域名多条路径，还能做 TLS。RKE2 自带 ingress-nginx，K3s 自带 Traefik，都是现成的 Ingress Controller。我用 Ingress 给 Rancher、ArgoCD、业务应用配过域名和 HTTPS。
- 【追问】
  - Q：NodePort 访问不通，排查顺序是什么？A：Pod 通不通 → Service endpoints 有没有 → 节点上 NodePort 有没有监听（ss -lnt）→ 防火墙/安全组是否放行 → 有 externalTrafficPolicy: Local 时还要看 Pod 是否在该节点。
  - Q：externalTrafficPolicy 设成 Local 有什么坑？A：能保留客户端源 IP，但流量只会到有 Pod 的节点，可能导致负载不均；Cluster 模式会 SNAT 丢源 IP。
  - Q：Service 的 DNS 名是什么格式？A：`<svc名>.<命名空间>.svc.cluster.local`，同命名空间内直接写服务名即可。
- 【岗位标注】通用 / 技术支持 / 运维

### Q5. ConfigMap 和 Secret 是什么？有什么区别？

- 【考察点】配置管理基础，问得频率高，容易和小白区分开。
- 【参考回答】两者都是把配置从镜像里解耦出来，以卷挂载或环境变量的方式注入 Pod。区别就是 Secret 存敏感信息（密码、证书、token），内容是 base64 编码，而且 Secret 可以声明 type，比如 kubernetes.io/tls 类型就是给证书用的。注意 base64 不是加密，任何人能读集群就能解出来，所以生产上推荐配合外部方案（比如 Rancher 里可以接外部 secret 存储），至少要用 RBAC 限制权限。ConfigMap 我一般用 volume 挂载方式，改 ConfigMap 后卷里的文件会自动更新，但环境变量方式注入的不会变，需要重启 Pod。
- 【追问】
  - Q：ConfigMap 挂载的卷更新了，Pod 里立刻生效吗？A：kubelet 会定期同步（默认约 1 分钟），文件会更新，但应用不监听文件变化就不会重新加载；环境变量方式完全不会更新，只能重建 Pod。
  - Q：Secret 在 etcd 里是明文吗？A：默认是 base64 明文存 etcd，开启 encryption at rest 才能加密存储，这也回答了为什么 Secret 不等于安全。
  - Q：Secret 常见类型？A：Opaque 通用、kubernetes.io/tls 证书、kubernetes.io/dockerconfigjson 拉取私有镜像仓库用的。
- 【岗位标注】通用 / 运维

### Q6. PV、PVC、StorageClass 是什么？动态供给怎么工作的？

- 【考察点】简历明确写了"Longhorn + StorageClass 动态供给"，这是必考点，要能讲透三层关系。
- 【参考回答】PV 是集群里的存储资源，由管理员或存储插件创建；PVC 是用户对存储的申请，声明容量和访问模式；StorageClass 是中间层，定义"怎么动态创建 PV"。用户建 PVC 时指定 storageClassName，Provisioner（比如 Longhorn 的 driver.longhorn.io）就会按 StorageClass 里的参数自动创建一个 PV 绑定上去，这就是动态供给。没有 StorageClass 就只能手动静态建 PV。我在项目里用 Longhorn 作为 Provisioner，默认 3 副本，PVC 里指定 `storageClassName: longhorn`，有状态应用像 Postgres、Qdrant 部署时用 volumeClaimTemplates 自动给每个副本配一块盘。
- 【追问】
  - Q：PV 的 reclaimPolicy 有哪几种？A：Delete（PVC 删除时 PV 一起删，动态供给默认）、Retain（保留数据，需要管理员手动处理）、Recycle 已废弃。
  - Q：accessModes 三种模式？A：ReadWriteOnce 单节点读写、ReadOnlyMany 多节点只读、ReadWriteMany 多节点读写。Longhorn 默认块设备是 RWO，文件系统类型才支持 RWX。
  - Q：Pod 被重新调度到别的节点，PVC 里的数据还在吗？A：在。PV 是集群级资源，数据在存储端（Longhorn 的节点磁盘上），Pod 换节点后卷会被重新 attach 到新节点，这正是有状态应用容器化的前提。
- 【岗位标注】通用 / 运维 / AI 运维

### Q7. liveness、readiness、startup 三种探针的区别？

- 【考察点】探针是服务可用性保障，AI 运维岗尤其爱问（模型加载慢的场景）。
- 【参考回答】livenessProbe 判断容器是否"活着"，失败就杀掉重启，解决死锁、挂死问题；readinessProbe 判断容器是否"能接流量"，失败就从 Service endpoints 摘除，但不会杀容器；startupProbe 是启动期专用，启动完成前会禁用另外两个探针，防止启动慢的应用被 liveness 误杀。最典型的坑是 Java 应用或大模型服务启动要一两分钟，liveness 默认 initialDelaySeconds 设短了就会反复重启——正确做法是配 startupProbe，用更宽松的 failureThreshold 和 periodSeconds 给足启动时间，起来之后再用严格的 liveness 兜底。生产上我给模型服务配过 startupProbe：periodSeconds 10、failureThreshold 30，等于允许最多 5 分钟启动。
- 【追问】
  - Q：探针有哪些实现方式？A：httpGet（访问 HTTP 接口）、tcpSocket（端口探测）、exec（执行命令看退出码）。
  - Q：探针参数里 failureThreshold 和 periodSeconds 的乘积代表什么？A：代表从开始探测到判定失败的最长容忍时间，periodSeconds 是探测间隔，failureThreshold 是连续失败几次才判失败。
  - Q：readiness 失败但 liveness 通过，服务会怎样？A：Pod 状态 Running 但 Ready 为 0/1，Service 不转发流量给它，Pod 继续运行，适合做优雅摘流。
- 【岗位标注】通用 / 运维 / AI 运维

### Q8. 命名空间、ResourceQuota、LimitRange 是干什么的？

- 【考察点】多团队、多环境隔离是生产必备，运维岗常考。
- 【参考回答】命名空间是逻辑隔离单元，把资源、权限、配额按团队或环境切分，比如 dev/test/prod 各一个 namespace。ResourceQuota 是"总量控制"，限制一个 namespace 里所有 Pod 累加的 CPU、内存、PVC 数量，比如 `requests.cpu: "4"`、`limits.memory: 16Gi`、`pods: "20"`，超了创建就被拒。LimitRange 是"单容器控制"，给 namespace 里没写 requests/limits 的容器设默认值，还能限制单容器最大值最小值。我们当时把开发和测试环境分 namespace 隔离，每个环境一套配额，防止测试任务把集群资源吃光影响生产。
- 【追问】
  - Q：ResourceQuota 里的 requests 和 limits 都要配吗？A：最好都配，只配 requests 不配 limits 会出现"配额没超但实际可被挤爆"；只配 limits 不配 requests 会出现调度时按 0 算导致节点超卖。
  - Q：LimitRange 的 default 和 defaultRequest 区别？A：default 是没写 limits 时给的默认 limits，defaultRequest 是没写 requests 时的默认 requests。
  - Q：删不掉 namespace 卡在 Terminating 怎么办？A：多半是有资源没清完或 finalizer 卡住，`kubectl get ns <ns> -o yaml` 看 finalizers，确认无业务后手动清掉 finalizer（这是下策，慎用）。
- 【岗位标注】运维 / DevOps

### Q9. StatefulSet、DaemonSet、Job、CronJob 分别用在什么场景？

- 【考察点】工作负载类型是基础分水岭，能区分"背过定义"和"真用过"。
- 【参考回答】Deployment 适合无状态服务。StatefulSet 给有状态服务用：每个 Pod 有稳定网络标识（pod-0、pod-1），稳定存储（volumeClaimTemplates 每副本一块盘），启动/删除按顺序，数据库、中间件、向量库都该用它。DaemonSet 保证每个节点跑一个 Pod，节点加入自动补上，典型是 kube-proxy、calico 网络插件、Longhorn 的 instance-manager，还有日志采集 agent。Job 跑一次性任务，跑完 Pod 进入 Completed，用 completions 和 parallelism 控制并发，失败有 backoffLimit 重试；CronJob 是定时版，按 cron 表达式调度，比如每天凌晨备份、定期清理。我在项目里用 CronJob 做过 Longhorn 卷快照定期清理，embedding 批处理也设计成 Job 跑。
- 【追问】
  - Q：StatefulSet 更新策略？A：RollingUpdate 默认按序号逆序逐个更新，OnDelete 手动删才重建。
  - Q：CronJob 的 concurrencyPolicy 三种取值？A：Allow 允许并发、Forbid 上一次没跑完就跳过、Replace 直接杀掉上一次重跑。
  - Q：Job 一直不结束怎么办？A：看 backoffLimit 是否耗尽，`kubectl describe job` 看容器是否在反复失败，任务逻辑死循环也会导致 Pod 一直 Running。
- 【岗位标注】通用 / AI 运维

### Q10. 怎么控制 Pod 调度到指定节点？nodeSelector、亲和性、污点容忍区别？

- 【考察点】调度控制是运维高频操作，也是理解 scheduler 的入口。
- 【参考回答】nodeSelector 最简单，节点打了 label 后 Pod 指定 label 精确匹配。亲和性分 nodeAffinity 和 podAffinity：required 是硬约束（不满足不调度），preferred 是软偏好（尽量满足，不满足也调度）。污点 taint 是反过来的机制——给节点打污点（比如 `kubectl taint nodes node1 gpu=true:NoSchedule`），默认 Pod 都不能调度上去，只有显式声明了对应 toleration 的 Pod 才能上，所以污点适合"独占节点"场景，比如 GPU 节点只给模型服务、管理面节点不给业务 Pod。三种配合使用：nodeSelector 做粗分，nodeAffinity 做细粒度软硬约束，taint+toleration 做强制隔离。
- 【追问】
  - Q：污点有哪几种 effect？A：NoSchedule 不调度新 Pod；NoExecute 不仅不调度还驱逐已有 Pod；PreferNoSchedule 是软性的尽量不调度。
  - Q：节点 NotReady 时上面的 Pod 会怎样？A：默认控制器会给 NotReady 节点加 `node.kubernetes.io/not-ready:NoExecute` 污点，容忍时长默认 300 秒，超过后 Pod 被驱逐重建到其他节点。
  - Q：怎么把节点上的 Pod 全部赶走？A：`kubectl drain node1 --ignore-daemonsets --delete-emptydir-data`，排空后节点才能维护或下线，操作前记得 cordon。
- 【岗位标注】通用 / 运维

### Q11. HPA 怎么做水平扩缩容？

- 【考察点】弹性伸缩是运维/AI 运维重点，会问原理也会问命令。
- 【参考回答】HPA（HorizontalPodAutoscaler）根据 Pod 的资源指标自动调整副本数。前提是集群装了 metrics-server 采集 CPU/内存指标——RKE2 自带 metrics-server，K3s 也内置。用 `kubectl autoscale deployment nginx --cpu-percent=80 --min=2 --max=10` 就能建，或者写 YAML 配 minReplicas、maxReplicas、targetAverageUtilization。原理是控制器周期（默认 15 秒）拉取指标，用公式 期望副本数 = ceil(当前副本数 × 当前值 / 目标值) 计算，比如 2 个副本 CPU 均 90% 目标 80%，就扩到 3 个。注意 HPA 只做水平扩展，要结合 Pod 的 requests 才准确，而且有冷却/延迟机制（scaleDown 默认 5 分钟）防止抖动。
- 【追问】
  - Q：为什么 HPA 要求 Pod 必须配 requests？A：utilization 是"当前值/requests"算出来的百分比，没配 requests 就无法计算，HPA 会报 failed to get memory utilization。
  - Q：内存能配 HPA 吗？A：可以，但内存不像 CPU 会因负载升高而升，通常只做"超过就扩容"的兜底，避免把 Pod 打到 OOMKilled。
  - Q：没有 metrics-server 时 HPA 会怎样？A：HPA 一直 Unknown 状态，不扩缩容，所以排障时先 `kubectl top nodes` 验证 metrics-server 是否正常。
- 【岗位标注】通用 / AI 运维 / DevOps

### Q12. RBAC 怎么做权限控制？Role 和 ClusterRole 什么区别？

- 【考察点】权限安全基础，运维/DevOps 岗会问，还容易问到实际配置。
- 【参考回答】RBAC 用四类对象：Role 管某个命名空间内的权限，ClusterRole 管集群级权限（节点、PV、所有命名空间），RoleBinding 把 Role 绑到某个命名空间的主体上，ClusterRoleBinding 绑到集群范围。主体可以是 User、Group、ServiceAccount。授权规则由 apiGroups、resources、verbs 描述，比如 `kubectl create role pod-reader --verb=get,list --resource=pods -n dev` 再 binding。生产上给 CI 或 ArgoCD 的最小权限就是"只读 + 特定命名空间"，我用 ServiceAccount 给 ArgoCD 配过 deploy 权限，配合 Rancher 的全局权限和项目权限做多团队隔离。
- 【追问】
  - Q：怎么验证某个账号有没有权限？A：`kubectl auth can-i get pods --as=system:serviceaccount:dev:ci`，或者 `--as` 模拟用户。
  - Q：RoleBinding 能绑定 ClusterRole 吗？A：可以，这是常见组合——ClusterRole + RoleBinding 等于"在单个命名空间内使用集群级规则"，比如把只读 ClusterRole 绑到 dev 命名空间。
  - Q：ServiceAccount 和 Secret 的关系？A：创建 ServiceAccount 会自动生成关联的 token Secret（新版是短时 token 机制），Pod 指定 serviceAccountName 后，kubelet 会把 token 挂到 /var/run/secrets/kubernetes.io/serviceaccount。
- 【岗位标注】运维 / DevOps

---

## 三、进阶篇

### Q1. Deployment 滚动更新的参数 maxSurge / maxUnavailable 到底怎么算？

- 【考察点】真考细节，很多人只背了 25% 不知道含义，DevOps 岗必问。
- 【参考回答】maxSurge 是"允许超出期望副本数多少个（或百分比）"，maxUnavailable 是"允许最多多少个（或百分比）副本不可用"。默认各 25%，replicas=4 时就是最多 5 个 Pod（多 1 个新的），最少 3 个可用（少 1 个旧的）。百分比按副本数取整，两者配合决定滚动节奏：maxUnavailable=1 保证至少 3 个在服务，适合不能降容量的服务；maxSurge=0、maxUnavailable=1 是"先删后建"，适合资源紧张。生产上发布必须关注 `kubectl rollout status` 是否卡在 Progressing，卡住 99% 是新 Pod 一直不 Ready（探针失败、镜像拉取失败、PVC 挂载失败），describe 新 RS 的 Pod 看原因。
- 【追问】
  - Q：发布时为什么有时看到新旧 Pod 同时存在？A：正常，滚动更新就是新旧 RS 并存、此消彼长的过程，直到新 RS 全部 Ready 旧 RS 缩到 0。
  - Q：maxSurge 用百分比时边界怎么处理？A：replicas=3、maxSurge=25% 时按公式算出来可能不是整数，实际按向上取整/向下取整的规则，一般最大多 1 个；精确控制就写整数。
  - Q：回滚后 revisionHistoryLimit 有什么用？A：控制保留几个历史 RS 用于回滚，默认 10，太多占 etcd 和资源，太少回滚选项少。
- 【岗位标注】DevOps / 运维

### Q2. 控制器模式（Reconcile 循环）是什么？拿 Deployment 举例说明。

- 【考察点】这是理解 K8s 的底层思维，能讲清楚说明不是只会 yaml。
- 【参考回答】K8s 的控制器都遵循"期望状态 vs 实际状态"的调谐循环：控制器的 informer 监听 etcd 里的对象变化，把对象的 spec 当作期望状态，通过 list/watch 拿到实际状态，两者不一致就执行操作让它收敛，操作完再汇报 status。拿 Deployment 举例：期望是 replicas=3，调谐时发现当前只有一个 RS 只有 2 个 Pod，就创建一个新 RS 或者给现有 RS 扩到 3；Pod 被删了，监听事件触发新一轮调谐，重新补一个。这个循环是异步、无锁的，任何时刻有人改了 spec 或实际状态跑偏，下一轮调谐都会拉回来——所以"删掉 Deployment 管理的 Pod 它一定会回来"，因为它符合期望状态。
- 【追问】
  - Q：控制器之间会打架吗？A：关键在所有权和标签选择器。Deployment 通过 ownerReference 声明对 RS 的所有权，RS 又 ownerReference 声明对 Pod 的所有权，垃圾回收器按 ownerReference 清理；标签选择器写太宽会同时命中多个控制器的 Pod，这就是"删了又出现/两个控制器抢 Pod"的原因。
  - Q：调谐失败会怎样？A：会退避重试（指数退避），status 里记录 condition 和错误，比如 Deployment 的 Progressing condition 报错；不会无限快速重试把 apiserver 打爆。
- 【岗位标注】通用 / 运维

### Q3. etcd 怎么备份和恢复？你实际做过吗？

- 【考察点】运维岗的高频核心题，简历写了"3 控制节点"，etcd 必须能答出具体命令。
- 【参考回答】备份用 etcdctl 的 snapshot 命令，RKE2 里 etcdctl 在 /var/lib/rancher/rke2/bin/ 下，etcd 只监听 127.0.0.1:2379，所以要带证书。备份命令大概是：
  `ETCDCTL_ENDPOINTS=https://127.0.0.1:2379 ETCDCTL_CACERT=/var/lib/rancher/rke2/server/tls/etcd/server-ca.crt ETCDCTL_CERT=/var/lib/rancher/rke2/server/tls/etcd/server-client.crt ETCDCTL_KEY=/var/lib/rancher/rke2/server/tls/etcd/server-client.key /var/lib/rancher/rke2/bin/etcdctl snapshot save /backup/etcd-snapshot-$(date +%F).db`
  恢复流程：先停所有 server 节点，用 `rke2 server --cluster-reset --cluster-reset-restore-path=<快照路径>` 在单节点恢复，其余节点再重新 join，恢复后集群 ID 会变，需要重新同步 kubeconfig 和 Rancher agent。我项目里把这套备份做成了 CronJob/定时脚本，快照保留最近 N 份，存到独立位置。K3s 更省事，自带自动快照，默认每 12 小时存到 /var/lib/rancher/k3s/server/db/snapshots/。
- 【追问】
  - Q：只备份 etcd 够吗？A：etcd 存的是集群状态，业务数据在 PV 里，要分开备份；另外证书、kubeconfig 也要留底。
  - Q：3 节点 etcd 挂 1 个怎么处理？A：集群还能正常服务（多数派 2/3），先修复该节点让它重新加入；如果同一时间挂 2 个就只剩 1 个，失去多数派只读不写，必须用快照恢复。
  - Q：快照恢复后 Rancher 里集群状态会怎样？A：恢复的是历史时间点的集群状态，之后新增的对象会丢，Rancher 的 cluster agent 可能要重建，所以恢复前要确认恢复到哪个时间点、丢多少数据可接受。
- 【岗位标注】运维

### Q4. kube-apiserver 处理一个请求的完整流程？准入控制器是什么？

- 【考察点】进阶必考，能区分"会用"和"懂原理"，运维岗尤其看重。
- 【参考回答】请求链路是：认证（Authentication）→ 鉴权（Authorization）→ 准入（Admission）→ 写入 etcd。认证确认"你是谁"，支持客户端证书、token（ServiceAccount JWT）、基本认证，kubectl 用的 kubeconfig 里就是客户端证书或 token。鉴权确认"你能干什么"，默认 RBAC 模式，按 apiGroups/resources/verbs 匹配。准入是写入 etcd 前的最后一道关卡，分 MutatingAdmissionWebhook（能改请求，比如给 Pod 注入默认值、注入 sidecar）和 ValidatingAdmissionWebhook（只能校验，比如拒绝不符合 LimitRange 的请求），还有内置的 LimitRanger、ResourceQuota、NamespaceLifecycle 都是准入控制器。apiserver 每收到写请求都会走这套链，所以它是唯一入口这句话是字面意思。
- 【追问】
  - Q：apiserver 怎么知道 ServiceAccount token 是有效的？A：token 是 JWT，由 controller-manager 签发，apiserver 验证签名和过期时间；新版用 TokenRequest API 签发短时 token 并绑定 audience。
  - Q：准入控制器举例说明实际场景？A：Rancher 会在集群里装自己的 webhook 校验/改写请求；Longhorn 也有 mutating webhook 给 Pod 注入挂载参数；cert-manager 用 webhook 校验 Certificate 资源。
- 【岗位标注】运维 / DevOps

### Q5. kube-proxy 的 iptables 和 IPVS 模式区别？Service 的转发原理？

- 【考察点】网络原理进阶题，能答出 IPVS 说明真研究过。
- 【参考回答】kube-proxy 把 Service 的虚拟 IP 转成实际 Pod IP，iptables 模式是经典的：每个 Service 生成一条 DNAT 规则链，按 1/3 概率（随机）转发到后端 Pod，endpoints 变化时重写整条链。优点是简单、通用；缺点是规则是链式的，Service 多到几百上千条时查找是 O(n)，性能下降，规则更新全量重写。IPVS 模式用内核的 IPVS 模块，基于哈希表，支持 wrr、lc 等负载算法，Service 多时性能稳定，是生产大集群的推荐模式。RKE2 可以通过 kube-proxy-mode 配置切换。另外提一句：Service 转发不感知后端 Pod 健康，Pod 挂了但还没摘除 endpoints 时，流量会打到失败 Pod，所以 readiness 探针摘除很重要。
- 【追问】
  - Q：怎么看当前集群用的是什么模式？A：`kubectl get cm -n kube-system kube-proxy -o yaml` 看 mode 字段，或者看节点上 kube-proxy 进程参数。
  - Q：NodePort 和 ClusterIP 底层都是 iptables 吗？A：是，NodePort 就是在 ClusterIP 的 DNAT 基础上再加一条端口映射规则（PREROUTING/OUTPUT 链），LoadBalancer 又包一层外部 LB。
- 【岗位标注】运维 / DevOps

### Q6. CNI 是什么？flannel 和 calico 有什么区别？怎么选？

- 【考察点】网络选型是架构题，简历写"高可用架构"，CNI 必须懂。
- 【参考回答】CNI（Container Network Interface）是容器网络的插件规范，负责给 Pod 分配 IP、配置网络命名空间、打通跨节点通信。K8s 本身不实现 Pod 网络，装什么 CNI 就是什么网络方案。flannel 默认用 VXLAN 做 overlay 隧道，简单、好排障、内核自带支持，但因为是隧道封包，性能略差，且默认不带 NetworkPolicy；calico 用 BGP 在三层直连（也可 IPIP），性能好、支持 NetworkPolicy，生产大规模首选。RKE2 默认装 calico，K3s 默认 flannel——这也是我选型时的一个现实理由：开发测试 K3s 图省事，生产 RKE2 用 calico 图性能和策略能力。选型就看三点：性能要求、是否需要 NetworkPolicy、团队排障能力。
- 【追问】
  - Q：NodePort 不通，怎么区分是 CNI 问题还是 kube-proxy 问题？A：先测 Pod 间网络（`kubectl exec` 里 ping 别的 Pod IP），通说明 CNI 正常，再查 kube-proxy 规则和 Service endpoints。
  - Q：calico 的 IPIP 和 BGP 模式区别？A：IPIP 是隧道封包，跨子网也能用；BGP 直连不封包，性能最好，但要求节点二层互通，跨网段要配 BGP peer。
- 【岗位标注】运维 / DevOps

### Q7. StatefulSet 怎么保证"稳定标识"？Headless Service 有什么用？

- 【考察点】有状态应用的灵魂题，AI 运维岗（数据库/向量库容器化）必问。
- 【参考回答】StatefulSet 给每个 Pod 一个稳定且唯一的网络标识：`<statefulset名>-<序号>`，比如 pg-0、pg-1，序号从 0 开始，创建、扩缩容、升级都按序号有序进行，Pod 重建后名字和主机名不变。配合 Headless Service（clusterIP: None），每个 Pod 会拿到自己的 DNS 记录 `pg-0.pg-hs.default.svc.cluster.local`，这就是数据库互相发现（比如 Postgres 主从、etcd 集群）的基础——节点失联重连还是用这个名字找到对方。存储上 volumeClaimTemplates 让每个副本有独立的 PVC，Pod 重建后 PVC 不变、数据不丢。所以迁移有状态应用，StatefulSet + Headless + PVC 是三件套。
- 【追问】
  - Q：StatefulSet 缩容会删哪个 Pod？A：序号最大的先删（比如缩到 2 个就删 pg-2），PVC 默认保留，再扩容回来还是原数据。
  - Q：Headless Service 的 DNS 为什么能列出所有 Pod IP？A：Headless Service 不建虚拟 IP，DNS 直接返回后端所有 Pod 的 IP（A 记录），配合 StatefulSet 的 pod DNS 名做点对点解析。
  - Q：Qdrant/Postgres 这类有状态服务在 K8s 上跑要注意什么？A：副本数固定、存储用 Longhorn 这类有副本保障的、节点维护前要 drain 保证数据副本健康、备份要另做。
- 【岗位标注】运维 / AI 运维

### Q8. Scheduler 调度一个 Pod 的完整流程？

- 【考察点】进阶调度题，能答出"过滤-打分"说明理解到位。
- 【参考回答】scheduler 是 list/watch 未调度的 Pod（spec.nodeName 为空），进入调度队列后分两步：先过滤（Filtering/预选），把不满足硬性条件的节点剔除——比如资源 requests 不够、有 NoSchedule 污点且 Pod 没对应 toleration、required nodeAffinity 不匹配、端口冲突；剩下候选节点后打分（Scoring/优选），按资源均衡（least requested）、亲和性权重、Pod 分布等策略给候选节点打分，选最高分的绑定（Bind），写回 Pod 的 spec.nodeName，然后 kubelet 看到自己被指派就拉镜像启动容器。调度是可插拔的，可以写自定义调度器或给 Pod 指定 schedulerName。所以 Pod Pending 的第一反应就是：是不是 filter 全灭了——describe 里会明确写出"0/8 nodes available"及每个节点被拒的原因。
- 【追问】
  - Q：nodeAffinity 的 required 和 preferred 分别在哪个阶段生效？A：required 在 Filter 阶段（不满足直接排除），preferred 在 Score 阶段（满足的节点加分，不满足也能被选中）。
  - Q：Pod 一直 Pending 且报 0/8 nodes available，具体怎么看原因？A：`kubectl describe pod` 的 Events 里会列出每个节点被拒的逐条原因（Insufficient cpu、Untolerated taint 等），这是最直接的答案。
- 【岗位标注】运维

### Q9. HPA 的底层原理是什么？自定义指标怎么做？

- 【考察点】AI 运维岗会往深问：CPU 之外怎么扩缩容。
- 【参考回答】HPA 控制器通过 metrics API 读指标，标准链路是 metrics-server 暴露 resource metrics（CPU/内存），自定义指标走 custom metrics API（比如 Prometheus Adapter 把 Prometheus 里的业务指标暴露成 custom metrics）。控制器默认每 15 秒同步一次，按"期望副本数 = ceil(当前副本数 × 当前值 / 目标值)"计算，多个指标时取算出的最大副本数。还有两个关键行为：扩容没有冷却，但缩容默认等待 5 分钟（scaleDown stabilization window，K8s 1.27+ 默认 300s）防止抖动；以及 HPA 与 VPA（垂直扩缩容）的区别，HPA 加副本、VPA 调 requests，生产上常配合用。模型服务按 QPS 或推理队列长度扩缩容就是走 custom metrics 的典型场景。
- 【追问】
  - Q：HPA 计算时 currentReplicas 突然涨了怎么办？A：刚扩容完指标还没回落，HPA 会先等 Pod ready 再评估，有 status 里的 conditions 可以看（AbleToScale、ScalingActive、ScalingLimited）。
  - Q：maxReplicas 到了还扛不住怎么办？A：看 ScalingLimited condition，说明顶到上限了，要调 max 或优化服务本身，HPA 不是无限扩容的银弹。
- 【岗位标注】AI 运维 / DevOps

### Q10. Helm Chart 的目录结构和核心概念？升级回滚怎么做？

- 【考察点】简历写了"熟悉 Helm Charts"，这是 DevOps 岗必考，要能讲出细节。
- 【参考回答】一个 Chart 的标准结构：Chart.yaml（元数据：name、version、apiVersion）、values.yaml（默认参数）、templates/（模板文件，用 Go template 渲染）、charts/（依赖子 chart）、crds/（CRD 定义）。核心概念是"模板 + 参数 = 渲染后的 YAML"，values 可以从命令行 `--set`、`-f values-prod.yaml` 覆盖，优先级 --set 最高。安装 `helm install release-name ./chart -n ns`，升级 `helm upgrade release-name ./chart -n ns`，升级失败用 `helm rollback release-name <版本号>` 回滚，`helm list -n ns` 看 release 状态，`helm template` 只渲染不部署用来预检。Helm 3 的升级是三方合并（用户上次修改、当前模板渲染、现有资源），所以手动 kubectl 改过的字段可能被覆盖——这也是为什么 Helm 管理的资源不要手动改。我们所有应用包括 Rancher、Longhorn、ArgoCD 都是 Helm 装的，参数化后一套 Chart 部署 dev/prod 两套环境。
- 【追问】
  - Q：Chart 里的模板怎么调试？A：`helm template` + `helm lint`，渲染错误会直接报错；复杂逻辑用 include 定义模板片段复用。
  - Q：Helm hook 是什么？A：templates 里带 annotations 标注 hook（pre-install、post-install、pre-delete 等）的资源，在 release 生命周期的指定时刻执行，比如 pre-install 跑个 Job 初始化数据库。
  - Q：CRD 放 crds/ 和 templates/ 的区别？A：crds/ 下的 CRD 不参与升级渲染、Helm 不管理其生命周期，适合装完就不动的；templates/ 里的 CRD 会被 Helm 管理（删除 release 时一起删）。
- 【岗位标注】DevOps

### Q11. StorageClass 有哪些关键字段？CSI 架构是什么？Longhorn 怎么接入的？

- 【考察点】简历写了"Longhorn 动态供给"，存储进阶题必问，AI 运维（向量库持久化）也爱问。
- 【参考回答】StorageClass 关键字段：provisioner（谁创建 PV，Longhorn 是 driver.longhorn.io）、parameters（传给 provisioner 的参数，Longhorn 里如 numberOfReplicas=3、dataLocality、nodeSelector）、reclaimPolicy（Delete/Retain）、allowVolumeExpansion（是否允许扩容）、volumeBindingMode（Immediate 立即绑定 / WaitForFirstConsumer 等 Pod 调度后再绑定，避免 PV 建错节点）。CSI 是存储插件标准，分 controller 插件（建删卷、快照）和 node 插件（节点上挂载、格式化），Longhorn 就是完整 CSI 实现：Longhorn manager 管理卷副本、instance-manager 跑数据面、csi-driver 对接 K8s。用户侧只写 PVC 指定 storageClassName，其余全部自动化——这就是我简历里说的动态供给方案，CMDB 的数据库、Qdrant、Postgres 都是这么给盘的。
- 【追问】
  - Q：volumeBindingMode 选 WaitForFirstConsumer 的场景？A：多可用区集群里不知道 Pod 会调度到哪个区时，先让 Pod 定节点再就近建卷，避免跨区挂载；Longhorn 单集群单机房一般 Immediate 就行。
  - Q：PVC 扩容怎么做？A：StorageClass 开了 allowVolumeExpansion 后，直接改 PVC 的 resources.requests.storage 字段，Longhorn 会在线扩容（文件系统要支持）。
  - Q：Longhorn 卷快照能当备份吗？A：快照在集群内，节点全挂就没了；要异地备份得配 backup target（S3/NFS），定期把快照推到远端，这才是真正的灾备。
- 【岗位标注】运维 / AI 运维

### Q12. 探针在生产上的最佳实践？说说你实际配过的参数。

- 【考察点】探针进阶：背参数容易，讲"为什么这么配"才算会，运维/AI 运维高概率追问。
- 【追问】
  - Q：liveness 误杀的真实案例？A：老版本很多人在 initialDelaySeconds 设 10 秒，Java 应用启动要 60 秒，10 秒后第一次探测失败、3 次失败被杀，无限重启——后来统一改成 startupProbe 方案。
  - Q：探针失败对流量有什么影响？A：readiness 失败立即从 Service endpoints 摘除，现有连接还在，新流量不再进来，所以配合优雅停机（preStop hook 加 sleep）能实现平滑发布。
- 【岗位标注】运维 / AI 运维

---

## 四、生产实战·刁钻篇

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

### Q5. 两个服务之间域名解析不通/超时，怎么排查？CoreDNS 出问题呢？

- 【考察点】DNS 是微服务最常见的隐形炸弹，AI 运维（微服务互相调用）尤其爱考。
- 【参考回答】分两层：先确认 DNS 服务本身，再确认解析链路。第一层：`kubectl -n kube-system get pods -l k8s-app=kube-dns` 看 CoreDNS Pod 是否 Running，`kubectl -n kube-system logs -l k8s-app=kube-dns --tail=50` 看报错；CoreDNS 挂了表现是所有服务间域名解析都失败。第二层：在出问题的 Pod 里 `kubectl exec <pod> -- nslookup <svc名>.<ns>.svc.cluster.local`，验证解析结果；再看 Pod 的 /etc/resolv.conf，默认 `ndots:5` 意味着 `foo` 这种短名会先尝试拼接多个 search 域，每次查询有 5 秒超时，多域串行查询叠加就变成"偶尔 10-25 秒卡顿"，这是经典性能坑。我实际修过一次：CoreDNS 上游 forward 指向的 DNS 不通，导致内部解析正常但外部域名全超时，改 Corefile 的 forward 目标解决。
- 【追问】
  - Q：Service 名解析通了但访问超时，往哪查？A：往下游走：Service 有没有 endpoints → 后端 Pod 是否 Ready → Pod 内端口是否真的监听 → kube-proxy 规则；DNS 只是第一站。
  - Q：ndots:5 的坑怎么绕过？A：应用配置里用完整域名 `svc.ns.svc.cluster.local` 或服务名加 `svc` 后缀，减少 search 域尝试次数；或者在 Pod 里覆盖 dnsConfig。
- 【岗位标注】运维 / AI 运维

### Q6. etcd 出问题/数据丢失，怎么恢复？你 3 控制节点的集群遇到过吗？

- 【考察点】简历写"3 控制节点 + Rancher 管理"，这题专门验证是否真做过高可用、真备份过。
- 【参考回答】分情况：如果只是单节点 etcd 挂了但多数派还在，集群不中断，把节点修好重新 join 就行，不需要恢复流程；如果失去多数派（3 节点挂 2 个），集群进入只读，必须用快照恢复：选一台节点，`rke2 server --cluster-reset` 配合 `--cluster-reset-restore-path=<快照>` 从快照重建，恢复后这台变成唯一 server，其余节点删掉旧 etcd 数据重新 join。关键在"平时有没有快照、快照在不在"，所以我项目里把备份做成定时任务并拷贝到集群外，而且恢复流程先在测试集群演练过——真到事故现场才第一次恢复，基本都会慌。恢复后要验证：kubectl get nodes 全 Ready、业务 Pod 恢复、Rancher 里集群 agent 重新连上（cattle-cluster-agent 偶尔要重启）。
- 【追问】
  - Q：为什么 etcd 要奇数节点？A：raft 共识需要多数派，3 节点容忍 1 个故障，4 节点也只容忍 1 个，白浪费一台，5 节点容忍 2 个。
  - Q：没有快照、etcd 全挂了怎么办？A：只能从备份介质恢复，或者认命重建集群——这就是"备份就是运维的命"的原因，所以每次面试我都会强调备份策略。
- 【岗位标注】运维

### Q7. 深挖：你的 3 控制节点 + 5 工作节点集群，控制面前面有没有负载均衡？单点在哪？证书怎么管理的？

- 【考察点】简历核心表述"设计并部署高可用 Kubernetes 架构"，这是最容易被连环追问的一段，答不好整个简历可信度崩。
- 【参考回答】3 个控制节点是给 apiserver、etcd、controller-manager、scheduler 做高可用，etcd 3 节点容忍 1 个故障。但有个现实问题：kubectl 和组件连 apiserver 需要一个固定入口，我们内网环境在控制面前面放了一个负载均衡入口（VIP/反向代理），把 6443 分发到 3 个控制节点；如果入口本身就是单点，那这个集群只能说"控制面组件高可用、入口单点"。另外数据面没有单点：5 个 worker 节点，业务 Deployment 多副本 + 反亲和性跨节点分布，有状态服务用 Longhorn 3 副本。证书这块：RKE2 自己签发管理集群证书（apiserver、etcd、kubelet 的），不用手动维护；应用层证书用 cert-manager + ClusterIssuer 自动签发续期，Rancher 的 CA 证书做成 Secret 供 ClusterIssuer 引用，应用域名证书到期前自动轮换。
- 【追问】
  - Q：3 个控制节点怎么初始化的，一个命令描述？A：第一台装 RKE2，config.yaml 里配 token，`systemctl enable --now rke2-server`；后两台 config.yaml 加 `server: https://<第一台IP>:9345` 和同样的 token，加入后自动组成 etcd 集群。
  - Q：worker 节点怎么加入？A：装 RKE2 agent，config.yaml 配 `server: https://<控制面入口>:9345` 和 token，`systemctl enable --now rke2-agent`，加入后 kubectl get nodes 验证 Ready。
  - Q：如果面试官问"你们控制面入口挂了会怎样"，你怎么圆？A：诚实说入口节点是当时的简化点，生产上应该用 keepalived VIP 或专业 LB 做入口高可用，这是集群演进计划里的一项。
- 【岗位标注】运维 / DevOps

### Q8. Longhorn 节点要维护（重启/下线），drain 卡住怎么办？磁盘满了呢？

- 【考察点】简历写了 Longhorn，这题考真实存储运维经验，drain 卡住是高频踩坑点。
- 【参考回答】Longhorn 节点维护的标准流程：先在 Longhorn UI 或命令里给卷做快照确认数据安全，然后 `kubectl cordon <node>` 禁止新调度，再 `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data`。drain 卡住的经典原因是：节点上有卷还处于 attached 状态（有 StatefulSet Pod 在用），或者副本只剩一个在该节点（最后一个副本导致 Longhorn 拒绝 detach，怕数据丢）。处理：把 Pod 迁走（先看有没有别的副本，`kubectl get volumes.longhorn.io -A` 或 UI 看 Replicas），必要时先在 Longhorn 里把该节点的副本调度出去（节点设置里禁止副本调度，让系统自动重建副本到其他节点），等卷 detach 再 drain。磁盘满的问题：Longhorn 磁盘空间不足会标记节点 disk 异常，卷变成 degraded，处理是先清理快照（`kubectl -n longhorn-system delete snapshots...` 或 UI 清理）、再加盘扩容，Longhorn 支持在线添加磁盘。另外注意 Longhorn 默认副本数 3，节点数小于 3 时副本会调度失败，所以生产至少 3 个带数据盘的 worker 节点。
- 【追问】
  - Q：drain 时 --ignore-daemonsets 是干嘛的？A：DaemonSet 的 Pod 在每个节点都有，drain 删不掉，必须忽略，否则 drain 会卡死在等 DaemonSet Pod 终止。
  - Q：维护节点导致卷 degraded 怎么办？A：只要还有健康副本，卷会继续服务，系统自动在其他节点补副本，补完回到 healthy；这期间不要并发维护第二个节点，否则可能只剩一个副本。
- 【岗位标注】运维 / AI 运维

### Q9. 生产 RKE2 集群怎么升级？先升什么？怎么回退？

- 【考察点】升级是生产运维最怕的活，能答出顺序和回退说明真干过。
- 【参考回答】RKE2 升级的核心是"先 agent 后 server、控制面节点逐个来、先验证再滚动"。流程：先在测试环境升一遍；生产上先备份 etcd 快照；然后升级 worker 节点（agent），每台升级完验证节点 Ready、业务正常再下一台；再逐个升级控制节点（server），每升完一台确认 etcd 健康（`/var/lib/rancher/rke2/bin/etcdctl endpoint health`）和 apiserver 正常。RKE2 支持 channel 管理（stable/latest），离线环境就手动下载对应版本的 tar 包替换。回退策略：RKE2 官方对降级支持有限，所以升级前必须留 etcd 快照和旧版本安装包，出问题用快照恢复。升级 Rancher 同理：先备份，小版本升级，升级完看 cattle-system 的 Pod 是否全部 Running、集群 agent 是否重连。还有一条经验：升级前看 release notes 有没有破坏性变更（比如 CNI、kube-proxy 模式参数变化）。
- 【追问】
  - Q：K3s 和 RKE2 升级方式一样吗？A：大体一样（都是替换二进制 + systemctl restart），K3s 还支持 `curl -sfL https://get.k3s.io | sh -` 脚本直接升；RKE2 官方推荐用 rke2-upgrade controller 自动化。
  - Q：升级控制节点时 etcd 会怎样？A：逐个升级时每台短暂不可用，只要多数派在线集群就正常，所以绝不能同时重启两台控制节点。
- 【岗位标注】运维 / DevOps

### Q10. 反直觉故障合集：Service 通了但 Pod 不通？滚动更新卡住？节点重启后 Pod 没回来？conntrack 表满？

- 【考察点】刁钻题压轴，考"见过世面"——这些反直觉现象只有真排过才会知道。
- 【参考回答】我挑三个最有代表性的：第一，Service 有 IP 有 endpoints 但访问不通，先查 kube-proxy 是不是没生成规则（iptables 模式 Service 多时规则全量重写慢、或者 kube-proxy 挂了），再查 conntrack 表满——`dmesg` 里报 `nf_conntrack: table full, dropping packet`，症状是连接间歇性超时，处理是调大 `net.netfilter.nf_conntrack_max` 并排查大量短连接（TIME_WAIT 堆积）。第二，滚动更新卡在 Progressing，新 Pod 一直 ContainerCreating 或 not Ready，describe 新 RS 的 Pod 看 events，常见是 PVC 没绑上、探针失败、镜像拉不下来；`kubectl rollout undo` 快速回退。第三，节点重启后 Pod 没被调度回来——先看节点是不是 Ready，再看 Pod 是不是被驱逐后其他节点也没资源，Deployment 管理的会自动重建，但如果是单副本且节点一直 NotReady，Pod 会卡在 Pending；还有一种情况是 Pod 用了 hostPath 或 nodeName 绑定，重启后只能回原节点。这三个的共同点是：现象反直觉，但都逃不出"describe + logs + events + 系统日志"这套固定流程。
- 【追问】
  - Q：conntrack 表满为什么会导致 Service 不通？A：Service 转发（DNAT/SNAT）依赖 conntrack 跟踪连接，表满后新连接建不起来，表现为间歇性失败，而不是全挂。
  - Q：节点重启后单副本有状态服务没回来，最危险的是什么？A：如果节点起不来，数据盘跟着节点走（Local 存储），业务直接不可用——这正是为什么有状态服务要用 Longhorn 这种分布式存储并保证多副本。
- 【岗位标注】运维 / DevOps / AI 运维

---
