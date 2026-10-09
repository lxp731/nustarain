---
title: Kubernetes 面试问答·基础篇（20 题）
date: 2026-10-09 08:20:00
categories: 技术
tags:
  - K8S
  - 面试

---

本文是《Kubernetes 面试问答》系列的基础篇，共 20 题，覆盖 K8s 架构与核心组件、Pod 生命周期、Deployment/ReplicaSet 与滚动更新回滚、更新策略、Service 与 Ingress、ConfigMap/Secret、存储挂载方式与 PV/PVC/StorageClass 动态供给、工作负载类型、调度控制（nodeSelector/亲和性/污点容忍/反亲和性）、命名空间与资源配额、三种探针、HPA 水平扩缩容、RBAC 基础，每题附参考回答与追问。

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师

> 系列导航：{% post_link 技术/kubernetes-interview-advanced 进阶篇（24题） %} / {% post_link 技术/kubernetes-interview-practical 刁钻篇（16题） %}

---

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

#### 补充：怎么列出 Deployment 可回滚的版本并回滚到指定版本？

###### 一、列出可回滚的版本

```bash
kubectl rollout history deployment/<deployment-name>
```

输出大致是这样，`REVISION` 就是回滚时要用的版本号：

```text
1REVISION  CHANGE-CAUSE
21         <none>
32         kubectl set image deployment/<name> <container>=<new-image>
43         kubectl set image deployment/<name> <container>=<new-image>
```

确认某个版本到底用了什么镜像/配置，再加 `--revision`：

```bash
kubectl rollout history deployment/my-app --revision=2
```

会输出该版本的 Pod Template、容器镜像、标签、注解等详细信息。

如果 `CHANGE-CAUSE` 是空的，说明没记录变更原因。注意 K8s v1.26+ 已移除 `--record` 参数，需要手动加 annotation：`kubectl annotate deploy/nginx kubernetes.io/change-cause="升级nginx到1.21"`。

###### 二、回滚到指定版本

```bash
# 回滚到上一个版本
kubectl rollout undo deployment/<deployment-name>

# 回滚到指定版本
kubectl rollout undo deployment/my-app --to-revision=2
```

`--to-revision` 默认值是 0，表示回滚到上一个版本。

想先看看会改成什么样再执行，可以用 dry-run：

```bash
kubectl rollout undo --dry-run=server deployment/my-app --to-revision=2
```

###### 三、验证

```bash
kubectl rollout status deployment/my-app
kubectl get pods
kubectl describe deployment/my-app
```

回滚完成后用 `rollout status` 确认状态，再用 `get pods` 看 Pod 情况，必要时 `describe` 确认资源配置。

###### 四、两个容易忽略的点

**1. 历史版本数量有限**

Kubernetes 默认保留 10 个修订历史，可通过 `spec.revisionHistoryLimit` 调整；超过限制的旧版本会被自动清理。所以别指望能回滚到很久以前的版本。

**2. 回滚本质是反向滚动更新**

核心逻辑是把目标版本对应的 ReplicaSet 副本数恢复到期望数量，同时把当前版本的 ReplicaSet 副本数降到 0，本质上是一次反向的滚动更新过程。因此回滚同样会触发 Pod 重建，可能造成服务短暂中断。

顺带一提，`kubectl rollout` 这套子命令对 Deployment、DaemonSet、StatefulSet 都适用。

---

排查滚动更新卡住时，`rollout history` 结合 `kubectl get rs -l app=xxx` 看新旧 RS 的 READY 数，通常能很快定位问题，需要我展开讲讲这套排查思路吗？

### Q4. 除了 RollingUpdate，还有哪些更新策略？

Kubernetes 里“更新策略”要分两层看： **Deployment 原生支持的** 和 **需要额外工具/其他控制器实现的**。

##### Deployment 原生支持的策略

| 策略 | 行为 | 适用场景 |
| --- | --- | --- |
| **RollingUpdate** | 逐步替换旧 Pod，新旧 Pod 会短暂共存 | 生产环境默认选择，追求零停机 |
| **Recreate** | 先删掉所有旧 Pod，再创建新 Pod | 开发测试、单副本、不能新旧版本共存的应用 |

###### Recreate

`spec.strategy.type: Recreate` 时，Deployment 会：

1. 先终止所有旧 Pod；
2. 等旧 Pod 全部删除；
3. 再创建新版本 Pod。

更新期间会有短暂服务中断，所以生产环境一般不会随便用它，除非业务能接受停机，或者新旧版本不能同时运行。

###### RollingUpdate

这是默认策略，通过 `maxSurge` 和 `maxUnavailable` 控制替换节奏。

你前面问的 `maxSurge=0、maxUnavailable=1` 就是这种策略的一种保守形态。

##### 其他控制器里的更新策略

| 控制器 | 策略 | 说明 |
| --- | --- | --- |
| **StatefulSet** | RollingUpdate / OnDelete | RollingUpdate 按序号逆序更新；OnDelete 需要手动删除旧 Pod 才会创建新 Pod |
| **DaemonSet** | RollingUpdate / OnDelete | RollingUpdate 逐节点更新；OnDelete 同样要手动删除旧 Pod |

StatefulSet 的 RollingUpdate 还支持 `partition`，可以只更新序号大于等于 partition 的 Pod，适合分批灰度。

##### 需要借助 Ingress、Service Mesh 或发布工具实现的策略

这些不是 Deployment 原生的 `spec.strategy.type`，而是通过 **流量控制** 实现的发布方式：

| 策略 | 核心思路 | 典型实现 |
| --- | --- | --- |
| **蓝绿部署** | 同时保留旧版本和新版本，通过 Service/Ingress 切换流量 | Service selector 切换、Argo Rollouts、Flagger |
| **金丝雀发布** | 先给少量流量给新版本，观察指标后再全量 | Istio、Nginx Ingress、Argo Rollouts |
| **A/B 测试** | 同时运行多个版本，按用户特征分流 | Service Mesh、Ingress 权重/Header 路由 |
| **影子部署** | 复制真实流量到新版本，但不影响真实用户响应 | Istio 流量镜像 |

##### 还有一类：原地升级

**原地升级 / InPlaceUpdate** 不是标准 Deployment 的内置策略，通常由 OpenKruise 等扩展控制器实现。它不删除 Pod，只替换 Pod 里的容器镜像或资源，Pod IP、节点、同 Pod 内其他容器可以保持不变。

##### 怎么选

- **普通无状态服务**：优先用 `RollingUpdate`。
- **不能新旧版本共存**：考虑 `Recreate`，但要接受短暂停机。
- **有状态服务**：用 StatefulSet 的 RollingUpdate，必要时配合 `partition`。
- **节点级组件**：用 DaemonSet 的 RollingUpdate。
- **高风险发布、需要精细灰度**：用蓝绿、金丝雀、A/B 或影子部署，通常需要 Ingress/Service Mesh 或 Argo Rollouts、Flagger 这类工具。

### Q5. imagePullPolicy 有哪些取值？默认行为是什么？

Kubernetes 里 `imagePullPolicy` 主要有 **3 种正式值**，另外还有一个较少见的实验性值。

##### 正式支持的取值

| 策略 | 行为 | 适用场景 |
| --- | --- | --- |
| `IfNotPresent` | 本地有镜像就直接用，没有才拉取 | 生产环境、固定版本镜像 |
| `Always` | 每次启动容器都向仓库查询，必要时拉取 | 开发环境、CI/CD、`:latest` 镜像 |
| `Never` | 不拉取远程镜像，只用本地已有镜像 | 离线环境、本地调试、预加载镜像 |

##### 实验性取值

`OnFailure` 是 Kubernetes 1.19 引入的 Beta 特性：如果本地镜像存在，先尝试用本地镜像启动；如果启动失败，再尝试从远程仓库拉取。 它目前不是通用稳定特性，生产环境不建议依赖它。

##### 不写 `imagePullPolicy` 时的默认行为

如果你没有显式配置 `imagePullPolicy`，Kubernetes 会根据镜像标签自动选择：

| 镜像写法 | 默认策略 |
| --- | --- |
| `nginx:latest` | `Always` |
| `nginx`（无标签） | `Always` |
| `nginx:1.25` | `IfNotPresent` |
| `nginx@sha256:xxx` | `IfNotPresent` |

也就是说， **只有 `:latest` 或没有标签时才会默认 `Always`**；使用固定版本标签或摘要时，默认是 `IfNotPresent`。

##### 几个容易踩坑的点

- `:latest` 不是“最新版本”，它只是一个可变标签；生产环境建议用固定版本号或摘要。
- `IfNotPresent` 不会检查远程仓库是否有新镜像，只看本地是否存在同名镜像。
- `Always` 不是每次都完整下载镜像，如果摘要没变，容器运行时通常会复用本地层。
- `Never` 要求所有调度到的节点都已有镜像，否则 Pod 会启动失败。
- 私有仓库镜像还需要配合 `imagePullSecrets`，否则可能拉取失败。

##### 简单选择建议

- **生产环境**：`imagePullPolicy: IfNotPresent` + 固定版本标签/摘要。
- **开发/CI**：`imagePullPolicy: Always` + `:latest` 或分支标签。
- **离线/本地调试**：`imagePullPolicy: Never` + 提前在节点上导入镜像。

### Q6. Service 有哪几种类型？和 Ingress 什么区别？

- 【考察点】网络暴露链路是面试必考，也是排障高频场景。
- 【参考回答】Service 是四层负载均衡抽象，有稳定 IP 和 DNS 名。ClusterIP 只在集群内访问，是默认类型；NodePort 在每个节点开一个 30000-32767 的端口转发到 Service；LoadBalancer 需要云厂商或裸金属的负载均衡器（比如 metallb）配合，底层其实还是 NodePort + 外部 LB；还有 ExternalName 做 DNS 别名。Ingress 是七层的，按域名和路径路由到 Service，一个 Ingress 可以管多个域名多条路径，还能做 TLS。RKE2 自带 ingress-nginx，K3s 自带 Traefik，都是现成的 Ingress Controller。我用 Ingress 给 Rancher、ArgoCD、业务应用配过域名和 HTTPS。
- 【追问】
  - Q：NodePort 访问不通，排查顺序是什么？A：Pod 通不通 → Service endpoints 有没有 → 节点上 NodePort 有没有监听（ss -lnt）→ 防火墙/安全组是否放行 → 有 externalTrafficPolicy: Local 时还要看 Pod 是否在该节点。
  - Q：externalTrafficPolicy 设成 Local 有什么坑？A：能保留客户端源 IP，但流量只会到有 Pod 的节点，可能导致负载不均；Cluster 模式会 SNAT 丢源 IP。
  - Q：Service 的 DNS 名是什么格式？A：`<svc名>.<命名空间>.svc.cluster.local`，同命名空间内直接写服务名即可。
- 【岗位标注】通用 / 技术支持 / 运维

### Q7. ConfigMap 和 Secret 是什么？有什么区别？

- 【考察点】配置管理基础，问得频率高，容易和小白区分开。
- 【参考回答】两者都是把配置从镜像里解耦出来，以卷挂载或环境变量的方式注入 Pod。区别就是 Secret 存敏感信息（密码、证书、token），内容是 base64 编码，而且 Secret 可以声明 type，比如 kubernetes.io/tls 类型就是给证书用的。注意 base64 不是加密，任何人能读集群就能解出来，所以生产上推荐配合外部方案（比如 Rancher 里可以接外部 secret 存储），至少要用 RBAC 限制权限。ConfigMap 我一般用 volume 挂载方式，改 ConfigMap 后卷里的文件会自动更新，但环境变量方式注入的不会变，需要重启 Pod。
- 【追问】
  - Q：ConfigMap 挂载的卷更新了，Pod 里立刻生效吗？A：kubelet 会定期同步（默认约 1 分钟），文件会更新，但应用不监听文件变化就不会重新加载；环境变量方式完全不会更新，只能重建 Pod。
  - Q：Secret 在 etcd 里是明文吗？A：默认是 base64 明文存 etcd，开启 encryption at rest 才能加密存储，这也回答了为什么 Secret 不等于安全。
  - Q：Secret 常见类型？A：Opaque 通用、kubernetes.io/tls 证书、kubernetes.io/dockerconfigjson 拉取私有镜像仓库用的。
- 【岗位标注】通用 / 运维

### Q8. K8s 中 Pod 挂载存储有哪些方式？

K8s 里挂载存储主要分三类： **Pod 级临时卷、节点本地卷、持久化存储卷**，另外还有专门用来挂配置和敏感信息的特殊卷。

##### 1. 临时存储卷

| 类型 | 特点 | 场景 |
| --- | --- | --- |
| `emptyDir` | Pod 创建时生成，Pod 删除后数据丢失；可用磁盘或 `medium: Memory` | 容器间共享临时文件、缓存、中间计算结果 |
| `genericEphemeralVolume` | 通过 PVC 模板创建的临时卷，Pod 删除后自动清理 | 需要特定存储类型但不需要长期保留 |

##### 2. 节点本地存储

| 类型 | 特点 | 场景 |
| --- | --- | --- |
| `hostPath` | 直接挂载宿主机目录，Pod 删除后数据留在节点，但 Pod 漂移会丢失 | 日志收集、监控 Agent、单节点测试 |
| `local` PV | 节点本地磁盘，但有调度感知，Pod 会被调度到对应节点 | 高性能数据库、对 IO 要求高的有状态应用 |

`hostPath` 生产环境要慎用，存在安全风险，而且跨节点部署时容易行为不一致。

##### 3. 持久化存储卷：PV / PVC / StorageClass

这是生产环境最常用的方式。

- **PV**：集群级持久化存储资源，生命周期独立于 Pod。
- **PVC**：应用侧的存储申请，Pod 通过 PVC 使用存储。
- **StorageClass**：定义存储后端和参数，支持动态创建 PV。
- **CSI**：容器存储接口，现在扩展第三方存储的主流方式，支持快照、扩容等。

常见后端包括 NFS、Ceph RBD/CephFS、GlusterFS、iSCSI、云盘等。

典型链路是：

```text
Pod → PVC → PV → StorageClass / CSI → 后端存储
```

##### 4. 配置与敏感信息卷

| 类型 | 用途 |
| --- | --- |
| `configMap` | 挂载配置文件、环境变量 |
| `secret` | 挂载密码、证书、Token 等敏感数据 |
| `downwardAPI` | 把 Pod 元数据以文件形式注入容器 |
| `projected` | 把多种来源合并到一个目录 |

##### 挂载写法

Pod 里分两步：

```yaml
spec:
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: mysql-pvc
  containers:
    - name: app
      volumeMounts:
        - name: data
          mountPath: /var/lib/mysql
```

`volumes` 定义卷来源，`volumeMounts` 定义容器内的挂载路径。

##### 怎么选

- **临时缓存、容器间共享**：`emptyDir`。
- **节点级日志/监控**：`hostPath`，生产慎用。
- **高性能本地盘**：`local` PV。
- **数据库、有状态服务**：PVC + PV + StorageClass / CSI。
- **配置文件**：`configMap`。
- **密码证书**：`secret`。

需要的话我可以按 NFS、Ceph、云盘分别写一套 PVC/PV/StorageClass 的完整示例。

K8sVolume入门，10分钟搞定emptyDir和hostPath

### Q9. PV、PVC、StorageClass 是什么？动态供给怎么工作的？

- 【考察点】简历明确写了"Longhorn + StorageClass 动态供给"，这是必考点，要能讲透三层关系。
- 【参考回答】PV 是集群里的存储资源，由管理员或存储插件创建；PVC 是用户对存储的申请，声明容量和访问模式；StorageClass 是中间层，定义"怎么动态创建 PV"。用户建 PVC 时指定 storageClassName，Provisioner（比如 Longhorn 的 driver.longhorn.io）就会按 StorageClass 里的参数自动创建一个 PV 绑定上去，这就是动态供给。没有 StorageClass 就只能手动静态建 PV。我在项目里用 Longhorn 作为 Provisioner，默认 3 副本，PVC 里指定 `storageClassName: longhorn`，有状态应用像 Postgres、Qdrant 部署时用 volumeClaimTemplates 自动给每个副本配一块盘。
- 【追问】
  - Q：PV 的 reclaimPolicy 有哪几种？A：Delete（PVC 删除时 PV 一起删，动态供给默认）、Retain（保留数据，需要管理员手动处理）、Recycle 已废弃。
  - Q：accessModes 三种模式？A：ReadWriteOnce 单节点读写、ReadOnlyMany 多节点只读、ReadWriteMany 多节点读写。Longhorn 默认块设备是 RWO，文件系统类型才支持 RWX。
  - Q：Pod 被重新调度到别的节点，PVC 里的数据还在吗？A：在。PV 是集群级资源，数据在存储端（Longhorn 的节点磁盘上），Pod 换节点后卷会被重新 attach 到新节点，这正是有状态应用容器化的前提。
- 【岗位标注】通用 / 运维 / AI 运维

#### 补充：PVC → PV → StorageClass 三者的关系是怎么配合的？

可以这样理解： **PVC 是“我要多大存储”，PV 是“集群里实际的一块存储”，StorageClass 是“自动创建 PV 的模板”。**

###### 三者各自是什么

| 对象 | 角色 | 谁更关心 |
| --- | --- | --- |
| **PVC** | 应用对存储的“申请单” | 开发者 / 应用 |
| **PV** | 集群里真实存在的一块存储资源 | 集群 / 存储系统 |
| **StorageClass** | 定义“怎么自动创建 PV”的模板 | 集群管理员 |

###### 它们怎么配合

一条完整链路是：

```text
Pod 引用 PVC
  → PVC 申请存储
  → 找到已有 PV，或者触发 StorageClass 创建新 PV
  → PV 和 PVC 绑定
  → Pod 挂载 PVC 使用存储
```

###### 两种典型流程

###### 1. 静态绑定：管理员先准备好 PV

管理员先手工创建 PV，比如一块 NFS 目录或一块云盘。

```text
管理员创建 PV
  → 用户创建 PVC
  → K8s 找到满足大小、访问模式、StorageClass 的 PV
  → PVC 和 PV 绑定
```

###### 2. 动态创建：PVC 触发 StorageClass 自动创建 PV

这是生产里更常用的方式。

```text
管理员创建 StorageClass
  → 用户创建 PVC，并指定 storageClassName
  → K8s 发现没有匹配的 PV
  → 根据 StorageClass 调用 Provisioner / CSI Driver
  → 自动创建 PV
  → PV 和 PVC 绑定
```

###### 举个生活化例子

假设你要租房子：

- **PVC**：你说“我要一间 20 平米、能住人的房间”。
- **PV**：房东手里已经有一间现成的房间。
- **StorageClass**：你告诉中介“按标准户型给我自动生成一间房”，中介就去找施工队建一间。

如果房东手里已经有合适房间，就直接给你用；如果没有，就按 StorageClass 模板自动建一间。

###### 一句话记忆

**Pod 消费 PVC，PVC 绑定 PV，PV 可以手工创建，也可以由 StorageClass 自动创建。**

### Q10. StorageClass 也是 K8s 的定义对象吗？它在体系里的位置是什么？

是的， **StorageClass 是 Kubernetes 的一个正式 API 对象**，属于 `storage.k8s.io/v1` API 组，资源类型是 `StorageClass`，简称 `sc`。

你可以用这些命令查看它：

```bash
kubectl get storageclass
kubectl get sc
kubectl describe sc <name>
```

它和 PV、PVC 一样，都是 Kubernetes 持久化存储体系里的标准资源对象。

##### 它在体系里的位置

```text
Pod
  → PVC（应用申请存储）
  → PV（集群里的实际存储资源）
  → StorageClass（定义如何动态创建 PV）
  → Provisioner / CSI Driver（真正去创建底层存储）
```

StorageClass 本身不是存储，而是 **“PV 的创建模板”**。

当一个 PVC 指定了 `storageClassName`，而集群里没有匹配的静态 PV 时，Kubernetes 会根据对应的 StorageClass 调用 Provisioner 动态创建 PV。

##### 它主要定义什么

| 字段 | 作用 |
| --- | --- |
| `provisioner` | 使用哪个存储驱动，比如 CSI Driver |
| `parameters` | 传给驱动的参数，比如磁盘类型、IOPS、NFS 路径 |
| `reclaimPolicy` | PV 删除后的回收策略，`Delete` 或 `Retain` |
| `volumeBindingMode` | 立即绑定，还是等 Pod 调度后再绑定 |
| `allowVolumeExpansion` | 是否允许 PVC 扩容 |
| `mountOptions` | 挂载参数，比如 NFS 版本、挂载选项 |

##### 它和 PV、PVC 的区别

- **PV**：集群里已经存在的一块存储资源。
- **PVC**：应用申请存储的请求。
- **StorageClass**：定义“怎么自动创建 PV”的模板。

所以，StorageClass 不是 Pod 挂载卷时直接写的东西，而是 PVC 背后用来自动生成 PV 的对象。

### Q11. 给我一个 StorageClass 动态供给的完整案例

这里给一个 **动态供给场景** 的完整案例：部署一个 Nginx Pod，并通过 PVC 自动创建 PV，把数据持久化到 NFS 存储上。

##### 案例流程

```text
管理员创建 StorageClass
  → 用户创建 PVC，指定 storageClassName
  → Provisioner 自动创建 PV
  → PV 和 PVC 绑定
  → Pod 挂载 PVC 使用存储
```

##### 1. 创建 StorageClass

这里假设集群已经部署了 `nfs-subdir-external-provisioner`，它的 provisioner 名称是 `k8s-sigs.io/nfs-subdir-external-provisioner`。

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: nfs-sc
provisioner: k8s-sigs.io/nfs-subdir-external-provisioner
reclaimPolicy: Delete
volumeBindingMode: Immediate
```

##### 2. 创建 PVC

PVC 不需要写 PV 名字，只要指定 `storageClassName` 和容量即可。

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: nginx-pvc
spec:
  storageClassName: nfs-sc
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

##### 3. 创建 Pod 并挂载 PVC

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
spec:
  containers:
    - name: nginx
      image: nginx:latest
      volumeMounts:
        - name: nginx-storage
          mountPath: /usr/share/nginx/html
  volumes:
    - name: nginx-storage
      persistentVolumeClaim:
        claimName: nginx-pvc
```

##### 4. 验证结果

```bash
kubectl get sc
kubectl get pvc
kubectl get pv
kubectl get pod nginx-pod
```

如果一切正常，你会看到：

- `StorageClass nfs-sc` 存在；
- `nginx-pvc` 状态为 `Bound`；
- 自动出现一个 PV，状态也是 `Bound`；
- `nginx-pod` 启动成功。

##### 这个案例里三者的关系

- **PVC**：应用说“我要 1Gi 存储”。
- **StorageClass**：告诉 K8s “用 NFS Provisioner 自动创建 PV”。
- **PV**：Provisioner 在 NFS 上创建目录后，自动生成的集群存储资源。
- **Pod**：不直接操作 PV，只挂载 PVC。

如果你想要一个 **静态供给案例**，也就是管理员先手工创建 PV，再让 PVC 去绑定它，我也可以再写一版。

### Q12. StatefulSet、DaemonSet、Job、CronJob 分别用在什么场景？

- 【考察点】工作负载类型是基础分水岭，能区分"背过定义"和"真用过"。
- 【参考回答】Deployment 适合无状态服务。StatefulSet 给有状态服务用：每个 Pod 有稳定网络标识（pod-0、pod-1），稳定存储（volumeClaimTemplates 每副本一块盘），启动/删除按顺序，数据库、中间件、向量库都该用它。DaemonSet 保证每个节点跑一个 Pod，节点加入自动补上，典型是 kube-proxy、calico 网络插件、Longhorn 的 instance-manager，还有日志采集 agent。Job 跑一次性任务，跑完 Pod 进入 Completed，用 completions 和 parallelism 控制并发，失败有 backoffLimit 重试；CronJob 是定时版，按 cron 表达式调度，比如每天凌晨备份、定期清理。我在项目里用 CronJob 做过 Longhorn 卷快照定期清理，embedding 批处理也设计成 Job 跑。
- 【追问】
  - Q：StatefulSet 更新策略？A：RollingUpdate 默认按序号逆序逐个更新，OnDelete 手动删才重建。
  - Q：CronJob 的 concurrencyPolicy 三种取值？A：Allow 允许并发、Forbid 上一次没跑完就跳过、Replace 直接杀掉上一次重跑。
  - Q：Job 一直不结束怎么办？A：看 backoffLimit 是否耗尽，`kubectl describe job` 看容器是否在反复失败，任务逻辑死循环也会导致 Pod 一直 Running。
- 【岗位标注】通用 / AI 运维

### Q13. 怎么控制 Pod 调度到指定节点？nodeSelector、亲和性、污点容忍区别？

- 【考察点】调度控制是运维高频操作，也是理解 scheduler 的入口。
- 【参考回答】nodeSelector 最简单，节点打了 label 后 Pod 指定 label 精确匹配。亲和性分 nodeAffinity 和 podAffinity：required 是硬约束（不满足不调度），preferred 是软偏好（尽量满足，不满足也调度）。污点 taint 是反过来的机制——给节点打污点（比如 `kubectl taint nodes node1 gpu=true:NoSchedule`），默认 Pod 都不能调度上去，只有显式声明了对应 toleration 的 Pod 才能上，所以污点适合"独占节点"场景，比如 GPU 节点只给模型服务、管理面节点不给业务 Pod。三种配合使用：nodeSelector 做粗分，nodeAffinity 做细粒度软硬约束，taint+toleration 做强制隔离。
- 【追问】
  - Q：污点有哪几种 effect？A：NoSchedule 不调度新 Pod；NoExecute 不仅不调度还驱逐已有 Pod；PreferNoSchedule 是软性的尽量不调度。
  - Q：节点 NotReady 时上面的 Pod 会怎样？A：默认控制器会给 NotReady 节点加 `node.kubernetes.io/not-ready:NoExecute` 污点，容忍时长默认 300 秒，超过后 Pod 被驱逐重建到其他节点。
  - Q：怎么把节点上的 Pod 全部赶走？A：`kubectl drain node1 --ignore-daemonsets --delete-emptydir-data`，排空后节点才能维护或下线，操作前记得 cordon。
- 【岗位标注】通用 / 运维

### Q14. 如何给节点打污点、取消污点，并给 Pod 配置容忍？

K8s 里 **污点 Taint 是打在节点上的“排斥标记”**， **容忍 Toleration 是写在 Pod 上的“通行证”**。

##### 1. 给节点打污点

```bash
kubectl taint nodes <node-name> <key>=<value>:<effect>
```

示例：

```bash
kubectl taint nodes node1 dedicated=true:NoSchedule
```

三种 effect：

| effect | 含义 |
| --- | --- |
| `NoSchedule` | 没有匹配容忍的 Pod 不会被调度到这个节点 |
| `PreferNoSchedule` | 尽量避免调度，但不是强制 |
| `NoExecute` | 不调度新 Pod，并驱逐已运行且没有容忍的 Pod |

查看节点污点：

```bash
kubectl describe node <node-name>
```

##### 2. 取消节点污点

在污点后面加一个 `-`：

```bash
kubectl taint nodes <node-name> <key>=<value>:<effect>-
```

例如：

```bash
kubectl taint nodes node1 dedicated=true:NoSchedule-
```

如果只想按 key 删除某个污点的所有 effect：

```bash
kubectl taint nodes node1 dedicated-
```

删除后可以用 `kubectl describe node node1` 确认 `Taints` 是否已经消失。

##### 3. 给 Pod 配置容忍

在 Pod、Deployment、StatefulSet 的 `spec.template.spec` 里加 `tolerations`：

```yaml
tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

`operator` 有两种常用写法：

- **`Equal`**：key、value、effect 都要匹配；
- **`Exists`**：只要节点上有这个 key 的污点就匹配，不关心 value。

示例：

```yaml
tolerations:
  - key: "dedicated"
    operator: "Exists"
    effect: "NoSchedule"
```

如果是 `NoExecute` 污点，还可以加容忍时间：

```yaml
tolerations:
  - key: "dedicated"
    operator: "Equal"
    value: "true"
    effect: "NoExecute"
    tolerationSeconds: 3600
```

表示容忍 3600 秒，超过时间仍会被驱逐。

##### 注意

**容忍只是让 Pod 有资格调度到带污点的节点，并不保证一定调度上去。** 还要看节点资源、NodeSelector、亲和性、Pod 反亲和性等条件是否满足。

### Q15. 什么是反亲和性？硬约束和软约束怎么用？

**反亲和性是一种调度约束，用来告诉调度器：这个 Pod 尽量不要和某些 Pod、或某些节点放在一起。**

K8s 里没有单独的 `nodeAntiAffinity` 字段，通常分两种理解：

| 类型 | 作用 | 配置方式 |
| --- | --- | --- |
| **Pod 反亲和** | 不和带某些标签的 Pod 放在同一个拓扑域 | `spec.affinity.podAntiAffinity` |
| **节点反亲和** | 不调度到带某些标签的节点 | `nodeAffinity` 里用 `NotIn` / `DoesNotExist` |

##### 1. Pod 反亲和：把副本打散

这是最常见的用法。比如一个 Deployment 有 3 个副本，如果都落在同一台节点上，节点一挂，服务就全没了。

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: web
        topologyKey: kubernetes.io/hostname
```

含义是：

- 调度时，不要把这个 Pod 放到已经有 `app=web` Pod 的节点上；
- `topologyKey: kubernetes.io/hostname` 表示按“节点”打散；
- 如果改成 `topology.kubernetes.io/zone`，就是按“可用区”打散。

##### 2. 硬约束 vs 软约束

**硬约束**：`requiredDuringSchedulingIgnoredDuringExecution`

必须满足，否则 Pod 会一直 Pending。

```yaml
requiredDuringSchedulingIgnoredDuringExecution:
  - labelSelector:
      matchLabels:
        app: web
    topologyKey: kubernetes.io/hostname
```

**软约束**：`preferredDuringSchedulingIgnoredDuringExecution`

尽量满足，不满足也能调度。

```yaml
preferredDuringSchedulingIgnoredDuringExecution:
  - weight: 100
    podAffinityTerm:
      labelSelector:
        matchLabels:
          app: web
      topologyKey: kubernetes.io/hostname
```

##### 3. 节点反亲和：避开某些节点

比如不想让 Pod 调度到测试节点：

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: env
              operator: NotIn
              values: ["test"]
```

这表示：不要调度到 `env=test` 的节点上。

##### 4. 一个容易踩的坑

如果用硬反亲和要求“每个节点只能有一个副本”，那集群可用节点数必须 ≥ 副本数，否则 Pod 会调度失败。

简单记： **亲和是“想和谁在一起”，反亲和是“不想和谁在一起”。** 生产里最常用的是 Pod 反亲和，把多副本打散到不同节点或不同可用区，避免单点故障。

---

反亲和和污点+容忍配合用，能把"不跟谁一起"和"只能跟谁一起"组合出很灵活的调度策略，要不要举个具体例子？

### Q16. 污点+容忍+NodeSelector 怎么把某类业务固定调度到专用节点？

要把某类业务固定到专用节点， **最稳的组合是：节点打标签 + 节点打污点 + Pod 配容忍 + Pod 配 nodeSelector 或 nodeAffinity**。

- **污点**：让普通 Pod 进不来专用节点；
- **容忍**：让专用 Pod 有资格进专用节点；
- **nodeSelector / nodeAffinity**：让专用 Pod 必须或优先落到专用节点；
- **标签**：给专用节点一个身份标识。

##### 1. 给专用节点打标签

假设有一台专用节点 `node-dedicated-01`，专门跑高负载服务：

```bash
kubectl label nodes node-dedicated-01 workload=dedicated
```

##### 2. 给专用节点打污点

这样普通业务 Pod 就不会被调度到这台节点上：

```bash
kubectl taint nodes node-dedicated-01 workload=dedicated:NoSchedule
```

效果是：没有匹配容忍的 Pod 不能调度上来。

##### 3. 给专用 Pod 配容忍和 nodeSelector

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dedicated-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: dedicated-app
  template:
    metadata:
      labels:
        app: dedicated-app
    spec:
      nodeSelector:
        workload: dedicated
      tolerations:
        - key: workload
          operator: Equal
          value: dedicated
          effect: NoSchedule
      containers:
        - name: app
          image: myapp:latest
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1"
              memory: "1Gi"
```

这里：

- `nodeSelector` 保证 Pod **只能调度到标签为 `workload=dedicated` 的节点**；
- `tolerations` 保证 Pod **可以进入带 `workload=dedicated:NoSchedule` 污点的节点**；
- 普通 Pod 没有容忍，进不来；
- 专用 Pod 有容忍 + nodeSelector，会固定落到专用节点。

##### 4. 更推荐的写法：用 nodeAffinity 替代 nodeSelector

`nodeSelector` 是硬匹配，但表达能力比较弱。生产上更常用 `nodeAffinity`：

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: workload
              operator: In
              values:
                - dedicated
```

如果希望节点不可用时能回退到其他节点，可以用软亲和：

```yaml
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: workload
              operator: In
                values:
                  - dedicated
```

##### 5. 三者分工

| 机制 | 作用 | 放在哪里 |
| --- | --- | --- |
| 标签 | 标识节点身份 | 节点 |
| 污点 | 阻止普通 Pod 进入 | 节点 |
| 容忍 | 允许专用 Pod 进入 | Pod |
| nodeSelector / nodeAffinity | 让专用 Pod 落到指定节点 | Pod |

##### 一个容易踩的坑

**只配容忍，不配 nodeSelector / nodeAffinity，Pod 不一定会落到专用节点。**

容忍只是“允许进入”，不是“必须进入”。

反过来， **只配 nodeSelector，不打污点，普通 Pod 仍然可能调度到专用节点**，达不到隔离效果。

所以生产上固定业务到专用节点，最稳的就是： **标签 + 污点 + 容忍 + 亲和性** 一起用。

---

K8s调度三阶段，污点&容忍&亲和性

### Q17. 命名空间、ResourceQuota、LimitRange 是干什么的？

- 【考察点】多团队、多环境隔离是生产必备，运维岗常考。
- 【参考回答】命名空间是逻辑隔离单元，把资源、权限、配额按团队或环境切分，比如 dev/test/prod 各一个 namespace。ResourceQuota 是"总量控制"，限制一个 namespace 里所有 Pod 累加的 CPU、内存、PVC 数量，比如 `requests.cpu: "4"`、`limits.memory: 16Gi`、`pods: "20"`，超了创建就被拒。LimitRange 是"单容器控制"，给 namespace 里没写 requests/limits 的容器设默认值，还能限制单容器最大值最小值。我们当时把开发和测试环境分 namespace 隔离，每个环境一套配额，防止测试任务把集群资源吃光影响生产。
- 【追问】
  - Q：ResourceQuota 里的 requests 和 limits 都要配吗？A：最好都配，只配 requests 不配 limits 会出现"配额没超但实际可被挤爆"；只配 limits 不配 requests 会出现调度时按 0 算导致节点超卖。
  - Q：LimitRange 的 default 和 defaultRequest 区别？A：default 是没写 limits 时给的默认 limits，defaultRequest 是没写 requests 时的默认 requests。
  - Q：删不掉 namespace 卡在 Terminating 怎么办？A：多半是有资源没清完或 finalizer 卡住，`kubectl get ns <ns> -o yaml` 看 finalizers，确认无业务后手动清掉 finalizer（这是下策，慎用）。
- 【岗位标注】运维 / DevOps

#### 补充：只配 limits 不配 requests 为什么会导致节点超卖？

"节点超卖"可以理解为： **调度器账本上看起来还有资源，但节点实际可能已经扛不住了。**

###### 先澄清一个前提：只配 limits 不配 requests，request 通常不是 0

在 Kubernetes 里，如果你只写了 `limits` 没写 `requests`，API Server 的默认行为通常是把 `requests` 自动设成和 `limits` 一样。

所以严格来说，"只配 limits 不配 requests 导致 request 按 0 算"，更常见于下面几种情况：

- Pod 既没写 `requests`，也没写 `limits`；
- 命名空间没有配置 `LimitRange`，所以没有默认值；
- 或者有人误以为"没写 requests 就是 0，调度器会按 0 处理"。

真正让 request 变成 0 的，通常是 **什么都没配**。

###### 那"超卖"是怎么发生的？

调度器只看 `requests` 记账。

比如一个节点有 4 核 CPU：

| Pod | requests | limits |
| --- | --- | --- |
| Pod A | 0.5 | 2 |
| Pod B | 0.5 | 2 |
| Pod C | 0.5 | 2 |
| Pod D | 0.5 | 2 |

调度器账本上：

```text
已分配 requests = 0.5 + 0.5 + 0.5 + 0.5 = 2 核
节点还剩 2 核可调度
```

看起来没问题。

但如果这 4 个 Pod 同时跑满，它们需要的 CPU 是：

```text
12 + 2 + 2 + 2 = 8 核
```

而节点只有 4 核。

这就是 **超卖**：调度器按 requests 认为节点还能继续放 Pod，但所有 Pod 一旦同时忙起来，节点物理资源根本不够。

###### 如果 request 真的是 0，问题会更严重

假设 Pod 没配 `requests`，调度器会认为它"不占资源"。

于是调度器可能把大量 Pod 都塞到同一个节点上，因为它觉得：

```text
这个节点 requests 总和还很低，还能继续放。
```

但实际上这些 Pod 跑起来后都会吃 CPU 和内存。

结果就是：

- 节点 CPU 长期被打满；
- 内存不足时触发 OOMKill；
- 低优先级 Pod 被驱逐；
- 业务出现延迟升高、重启、503。

###### 一句话理解

- **requests**：调度器记账用的"保底资源"。
- **limits**：运行时不能超过的上限。
- **超卖**：所有 Pod 的 `limits` 或实际用量加起来，超过了节点真实容量。
- **request 为 0 的风险**：调度器以为节点很空，于是继续塞 Pod，最后节点被打爆。

生产上比较稳的做法是： **requests 不要留 0，limits 也不要拍脑袋设太大**，最好结合监控里的实际用量来配。

### Q18. liveness、readiness、startup 三种探针的区别？

- 【考察点】探针是服务可用性保障，AI 运维岗尤其爱问（模型加载慢的场景）。
- 【参考回答】livenessProbe 判断容器是否"活着"，失败就杀掉重启，解决死锁、挂死问题；readinessProbe 判断容器是否"能接流量"，失败就从 Service endpoints 摘除，但不会杀容器；startupProbe 是启动期专用，启动完成前会禁用另外两个探针，防止启动慢的应用被 liveness 误杀。最典型的坑是 Java 应用或大模型服务启动要一两分钟，liveness 默认 initialDelaySeconds 设短了就会反复重启——正确做法是配 startupProbe，用更宽松的 failureThreshold 和 periodSeconds 给足启动时间，起来之后再用严格的 liveness 兜底。生产上我给模型服务配过 startupProbe：periodSeconds 10、failureThreshold 30，等于允许最多 5 分钟启动。
- 【追问】
  - Q：探针有哪些实现方式？A：httpGet（访问 HTTP 接口）、tcpSocket（端口探测）、exec（执行命令看退出码）。
  - Q：探针参数里 failureThreshold 和 periodSeconds 的乘积代表什么？A：代表从开始探测到判定失败的最长容忍时间，periodSeconds 是探测间隔，failureThreshold 是连续失败几次才判失败。
  - Q：readiness 失败但 liveness 通过，服务会怎样？A：Pod 状态 Running 但 Ready 为 0/1，Service 不转发流量给它，Pod 继续运行，适合做优雅摘流。
- 【岗位标注】通用 / 运维 / AI 运维

### Q19. HPA 怎么做水平扩缩容？

- 【考察点】弹性伸缩是运维/AI 运维重点，会问原理也会问命令。
- 【参考回答】HPA（HorizontalPodAutoscaler）根据 Pod 的资源指标自动调整副本数。前提是集群装了 metrics-server 采集 CPU/内存指标——RKE2 自带 metrics-server，K3s 也内置。用 `kubectl autoscale deployment nginx --cpu-percent=80 --min=2 --max=10` 就能建，或者写 YAML 配 minReplicas、maxReplicas、targetAverageUtilization。原理是控制器周期（默认 15 秒）拉取指标，用公式 期望副本数 = ceil(当前副本数 × 当前值 / 目标值) 计算，比如 2 个副本 CPU 均 90% 目标 80%，就扩到 3 个。注意 HPA 只做水平扩展，要结合 Pod 的 requests 才准确，而且有冷却/延迟机制（scaleDown 默认 5 分钟）防止抖动。
- 【追问】
  - Q：为什么 HPA 要求 Pod 必须配 requests？A：utilization 是"当前值/requests"算出来的百分比，没配 requests 就无法计算，HPA 会报 failed to get memory utilization。
  - Q：内存能配 HPA 吗？A：可以，但内存不像 CPU 会因负载升高而升，通常只做"超过就扩容"的兜底，避免把 Pod 打到 OOMKilled。
  - Q：没有 metrics-server 时 HPA 会怎样？A：HPA 一直 Unknown 状态，不扩缩容，所以排障时先 `kubectl top nodes` 验证 metrics-server 是否正常。
- 【岗位标注】通用 / AI 运维 / DevOps

#### 补充：HPA 的配置项、计算公式和排查方法？

HPA 的核心思路是： **监控指标 → 计算期望副本数 → 更新 Deployment/StatefulSet 的 replicas**。它扩的是 Pod 副本数量，不是给单个 Pod 加 CPU/内存。

###### 1. 前提条件

要让 HPA 正常工作，通常需要满足：

- 集群里部署了 **Metrics Server**，否则 CPU、内存指标拿不到；
- 目标 Deployment/StatefulSet 必须配置 `resources.requests`；
- HPA 不支持 DaemonSet 这类不能水平扩缩的工作负载。

如果 Pod 没有 `requests`，HPA 无法计算利用率，就不会基于 CPU/内存做扩缩。

###### 2. 最基础的 HPA 配置

一个基于 CPU 利用率的 HPA 示例：

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
```

含义是：

- 目标工作负载是 `myapp`；
- 最少 2 个副本，最多 10 个副本；
- 当 Pod 平均 CPU 利用率超过 60% 时扩容；
- 低于阈值且稳定一段时间后缩容。

也可以用快捷命令创建：

```bash
kubectl autoscale deployment myapp --cpu-percent=60 --min=2 --max=10
```

###### 3. HPA 是怎么算副本数的

HPA 默认每 15 秒同步一次指标。

对于 CPU 利用率，核心公式大致是：

```text
期望副本数 = ceil(当前副本数 × 当前指标值 / 目标指标值)
```

比如：

- 当前 3 个副本；
- 目标 CPU 利用率 60%；
- 当前平均 CPU 利用率 90%；

那么：

```text
ceil(3 × 90 / 60) = ceil(4.5) = 5
```

HPA 会把 Deployment 的 replicas 调整到 5。

如果有多个指标，比如同时配置了 CPU 和内存，HPA 会分别计算，然后取 **最大的期望副本数**。

###### 4. 支持哪些指标

`autoscaling/v2` 支持四类指标：

| 类型 | 说明 |
| --- | --- |
| Resource | CPU、内存等基础资源指标 |
| Pods | Pod 级别指标，例如每个 Pod 的 QPS |
| Object | 某个 K8s 对象上的指标，例如 Ingress 请求数 |
| External | 集群外指标，例如 Kafka Lag、消息队列积压 |

如果要用自定义指标或外部指标，通常需要部署 **Prometheus Adapter**、 **KEDA** 之类的指标适配器。

###### 5. 控制扩缩速度：behavior

生产上不建议只配阈值，否则容易频繁抖动。可以用 `behavior` 控制扩容和缩容行为。

```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 0
    policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
    selectPolicy: Max
  scaleDown:
    stabilizationWindowSeconds: 300
    policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    selectPolicy: Min
```

几个关键字段：

- **stabilizationWindowSeconds**：稳定窗口。扩容默认 0 秒，缩容默认 300 秒，防止刚降一点负载就立刻缩容。
- **policies**：限制每次扩/缩多少，比如每 15 秒最多加 4 个 Pod，或最多增加 100%。
- **selectPolicy**：多条策略时选哪个。扩容常用 `Max`，缩容常用 `Min`。

###### 6. 排查 HPA 是否正常

```bash
kubectl get hpa
kubectl describe hpa myapp-hpa
kubectl top pods
```

重点看：

- `TARGETS` 是否显示当前值/目标值；
- `Conditions` 里是否有 `AbleToScale`、`ScalingActive`；
- 是否有 `FailedGetResourceMetric`、`FailedComputeMetricsReplicas` 等错误。

如果 `TARGETS` 显示 `<unknown>`，多半是 Metrics Server 没装，或者 Pod 没配 `requests`。

###### 生产建议

- CPU 目标利用率一般设在 **50%–80%**，不要压到 90% 以上；
- 缩容稳定窗口不要太短，避免流量波动时反复扩缩；
- 如果节点资源不够，HPA 扩出 Pod 也可能调度失败，这时需要配合节点弹性或提前预留资源；
- 对延迟敏感的服务，建议用 `behavior.scaleUp` 做快速扩容，`behavior.scaleDown` 做慢缩容。

---

K8sHPA自动扩缩，周末促销高峰期真香！

KubernetesHPA自动扩容，亲测效果

Kubernetes扩容，从手动到自动的玩法

### Q20. RBAC 怎么做权限控制？Role 和 ClusterRole 什么区别？

- 【考察点】权限安全基础，运维/DevOps 岗会问，还容易问到实际配置。
- 【参考回答】RBAC 用四类对象：Role 管某个命名空间内的权限，ClusterRole 管集群级权限（节点、PV、所有命名空间），RoleBinding 把 Role 绑到某个命名空间的主体上，ClusterRoleBinding 绑到集群范围。主体可以是 User、Group、ServiceAccount。授权规则由 apiGroups、resources、verbs 描述，比如 `kubectl create role pod-reader --verb=get,list --resource=pods -n dev` 再 binding。生产上给 CI 或 ArgoCD 的最小权限就是"只读 + 特定命名空间"，我用 ServiceAccount 给 ArgoCD 配过 deploy 权限，配合 Rancher 的全局权限和项目权限做多团队隔离。
- 【追问】
  - Q：怎么验证某个账号有没有权限？A：`kubectl auth can-i get pods --as=system:serviceaccount:dev:ci`，或者 `--as` 模拟用户。
  - Q：RoleBinding 能绑定 ClusterRole 吗？A：可以，这是常见组合——ClusterRole + RoleBinding 等于"在单个命名空间内使用集群级规则"，比如把只读 ClusterRole 绑到 dev 命名空间。
  - Q：ServiceAccount 和 Secret 的关系？A：创建 ServiceAccount 会自动生成关联的 token Secret（新版是短时 token 机制），Pod 指定 serviceAccountName 后，kubelet 会把 token 挂到 /var/run/secrets/kubernetes.io/serviceaccount。
- 【岗位标注】运维 / DevOps

---

#### 补充：RBAC 的四类对象怎么配合使用？

K8s 的 RBAC 由四类对象组成： **Role、ClusterRole、RoleBinding、ClusterRoleBinding**。

权限模型可以简单记成：

```text
谁（User / Group / ServiceAccount）
通过 Binding
获得 Role / ClusterRole 里定义的权限
对哪些资源执行哪些操作
```

###### Role 和 ClusterRole 的区别

| 对象 | 作用范围 | 典型用途 |
| --- | --- | --- |
| **Role** | 命名空间级别 | 控制某个 namespace 内的 Pod、Service、ConfigMap 等 |
| **ClusterRole** | 集群级别 | 控制 Node、PV、Namespace，或跨所有 namespace 授权 |
| **RoleBinding** | 命名空间级别 | 把 Role 或 ClusterRole 绑定到当前 namespace |
| **ClusterRoleBinding** | 集群级别 | 把 ClusterRole 绑定到整个集群 |

**Role 必须指定 namespace，ClusterRole 没有 namespace。**

ClusterRole 可以用来授权命名空间资源，也可以授权集群级资源，比如 Node、PV、Namespace。

###### 1. 给命名空间内授权：Role + RoleBinding

比如只允许在 `dev` 命名空间里查看 Pod：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: dev
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

绑定给用户或 ServiceAccount：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: dev
subjects:
  - kind: User
    name: alice
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

这样 `alice` 只能在 `dev` 命名空间里读取 Pod，不能操作其他 namespace。

###### 2. 给集群范围授权：ClusterRole + ClusterRoleBinding

比如允许查看节点：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-viewer
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["get", "list", "watch"]
```

绑定到用户：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: node-viewer-binding
subjects:
  - kind: User
    name: alice
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: node-viewer
  apiGroup: rbac.authorization.k8s.io
```

这样 `alice` 可以查看整个集群的节点。

###### 3. 常见组合：ClusterRole + RoleBinding

这个组合很实用： **用 ClusterRole 定义权限模板，再用 RoleBinding 限制生效范围。**

比如定义一个通用的“只读 Pod” ClusterRole：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-reader-global
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
```

然后只在 `dev` 命名空间里绑定：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-pod-reader
  namespace: dev
subjects:
  - kind: ServiceAccount
    name: dev-sa
    namespace: dev
roleRef:
  kind: ClusterRole
  name: pod-reader-global
  apiGroup: rbac.authorization.k8s.io
```

这样 `dev-sa` 只能在 `dev` 命名空间里读 Pod，不会自动获得其他 namespace 权限。

###### 4. 排查权限是否生效

可以用 `kubectl auth can-i` 验证：

```bash
kubectl auth can-i list pods --as=alice -n dev
kubectl auth can-i get nodes --as=alice
kubectl auth can-i delete pods --as=alice -n dev
```

如果返回 `yes`，说明有权限；返回 `no`，说明没有。

###### 生产建议

- 优先使用命名空间级别授权，少用 `ClusterRoleBinding`。
- 避免 `resources: ["*"]`、`verbs: ["*"]` 这类通配符。
- 给 Pod 用最小权限的 ServiceAccount，必要时关闭 `automountServiceAccountToken`。
- 不要随便把用户加入 `system:masters`，这个组会绕过 RBAC。

简单记： **Role 管单个 namespace，ClusterRole 管整个集群；Binding 决定权限落到哪个用户、组或 ServiceAccount 上。**
