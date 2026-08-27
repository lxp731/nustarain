---
title: CMDB 容器化改造项目复盘：从虚拟机到 GitOps
date: 2026-08-27 10:05:00
categories: 技术
password: buzhidao
tags:
  - K8S
  - Docker
  - CI/CD
  - 项目复盘
  - 面试
  - 私密

---

我在神州信息做 Linux 系统工程师期间，主导了公司 CMDB 系统的容器化改造。这套 CMDB 原来是 Tomcat + MySQL + Elasticsearch 的传统架构，跑在虚拟机上，环境不一致、手动发布、扩缩容难，而且客户机房是无外网环境，交付部署周期很长。我牵头做了整体方案：用 K3…

<!--more-->

> 适用岗位：运维工程师 / 技术支持工程师 / AI 运维工程师 / DevOps 工程师（DevOps岗必考）

---

## 一、项目速览

我在神州信息做 Linux 系统工程师期间，主导了公司 CMDB 系统的容器化改造。这套 CMDB 原来是 Tomcat + MySQL + Elasticsearch 的传统架构，跑在虚拟机上，环境不一致、手动发布、扩缩容难，而且客户机房是无外网环境，交付部署周期很长。我牵头做了整体方案：用 K3S 搭开发测试环境、RKE2 搭生产级集群，Rancher 做多集群统一管理；自建 Harbor 私有镜像仓库，用 GitLab + GitLab Runner 打通从代码提交到镜像构建的 CI/CD，Argo CD 做 GitOps 自动发布；部署 Longhorn 提供持久化存储，把 MySQL/ES/Redis 中间件容器化，Cert-Manager 实现证书自动化；最后把整套方案做成支持无外网环境的离线交付包，含镜像搬运脚本和离线安装包。最终实现了业务服务 100% 容器化，部署效率提升约 60%。

---

## 二、项目背景

### 2.1 CMDB 是什么

- CMDB（Configuration Management Database，配置管理数据库）：记录 IT 资产、配置项（CI）及其关系的数据库系统，是运维自动化的数据底座——服务器、网络设备、软件、业务依赖关系都登记在里面，故障定位、变更管理、容量规划都依赖它。
- 本次改造的是公司给客户交付的 CMDB 业务系统：包含前端、后端 API 服务、数据库（PostgreSQL/MySQL）、缓存（Redis）、定时任务等一组服务，不是数据库本身。
- 【仓库 README 佐证的原系统技术栈（回答"这套系统本身是什么架构"时用）】CMDB：**Tomcat + MySQL + Elasticsearch**，war 包约 124M；同批迁移的 ITSM 系统：**Tomcat + MySQL + Redis + Elasticsearch + kkFileView**，war 包约 392M（kkFileView 在线预览依赖 OpenOffice/LibreOffice）。中间件版本：Tomcat 8080（≥8.0）、Redis 6379（≥4.0）、kkFileView 8012（v4）、Elasticsearch 7.6.0（9200）、MySQL 8.0（3306）。

### 2.2 为什么容器化（痛点）

1. **环境不一致**：传统方式在虚拟机上手工装环境，dev/test/prod 配置漂移，出现"在我机器上是好的"问题。
2. **发布靠手动**：打镜像、传包、改配置、重启服务、验证，一次发布半小时起步，且容易出错、回滚难。
3. **扩缩容与资源利用率差**：虚拟机粒度太粗，单机 4~8 核跑一个服务，资源浪费严重；流量上来没法快速水平扩容。
4. **交付慢**：客户/机房**无外网**，每台机器手动装依赖、拉镜像不现实，交付部署周期以天计，且不可复制。

### 2.3 约束条件（讲背景时主动带出，体现考虑周全）

- **无外网**：目标环境完全离线，所有依赖、镜像、安装包必须提前准备并本地化。
- **资源有限**：基础设施是 ESXi 虚拟化，节点规格普遍在 4~8 核 / 8~16G，不能按公有云标准规划。
- **内网域名**：统一使用内网私有域名（如 `harbor.internal`），没有公网证书可用，需要自建私有 CA。
- **可复制交付**：方案要能复制到多套客户环境，所以必须配套 IaC（Terraform）和离线安装文档。

### 2.4 项目周期与角色

- 2024.07 – 2024.12（简历时间段），岗位：Linux 系统工程师。
- 我主导方案设计与大部分落地实施，配合开发同事做服务容器化改造的逐项迁移。

---

## 三、完成情况（技术架构）

### 3.1 业务系统构成与迁移计划（先搞清楚迁什么）

- **迁移对象**（README 佐证）：CMDB = Tomcat + MySQL + Elasticsearch（war 包约 124M）；同批迁移的 ITSM = Tomcat + MySQL + Redis + Elasticsearch + kkFileView（war 包约 392M，kkFileView 在线预览依赖 OpenOffice/LibreOffice）。中间件版本：Tomcat 8080（≥8.0）、Redis 6379（≥4.0）、WebSocket 9090、kkFileView 8012（v4）、ES 7.6.0（9200）、MySQL 8.0（3306）。
- **里程碑**：2024.01 底完成基础环境搭建；2024 年底完成 CMDB 迁移。
- **2024.05.21 CMDB 容器化改造规划**（README Update）：Harbor 扩容 → 中间件服务部署（ES、MySQL）→ 源码 push GitLab → CI/CD reference ITSM → testing——即 CMDB 完全复用 ITSM 验证过的 GitOps 流水线。
- **ITSM 迁移四阶段**（240227_itsm_migration_plan.md，CMDB 照抄这套）：①前期调研（服务版本统计、MySQL/Redis/WebSocket/ES 连接配置收集、DB SQL 脚本）②流程设计（CI/CD 全流程、Git 项目结构、ArgoCD 设计）③服务部署（MySQL/ES/Redis 容器化）④ITSM GitOps Demo（改代码+版本号→push→自动发布验证）。
- **数据增长规划**：ITSM 每月约消耗 1G 磁盘，按 1~2 年规划 24G 左右——存储容量规划的依据。

### 3.2 集群规划（三套环境/早期架构，务必记清，回答"集群多大"全靠这张表）

**环境 A：开发测试环境（内网 10.20.80.x，仓库 250303/250307 文档）**

| 节点 | 规格 | IP | 角色 |
|---|---|---|---|
| k3s-rancher | 4c / 8g / 250g | 10.20.80.151 | 跑 Rancher v2.10.2 |
| k8s-harbor | 8c / 8g / 500g | 10.20.80.152 | Harbor v2.12.2（离线安装包部署） |
| k8s-master1 | 8c / 16g / 250g | 10.20.80.160 | master（etcd） |
| k8s-worker1 | 8c / 16g / 250g | 10.20.80.161 | worker |
| k8s-worker2 | 8c / 16g / 250g | 10.20.80.163 | worker |

**环境 B：交付/生产环境（10.10.3.x，以 2024.09 集群配置为准）**

| 节点 | IP | 规格 | 角色 |
|---|---|---|---|
| ubuntu11 / 12 / 13 | 10.10.3.11~13 | 8c / 16g / 100G | 控制节点（ETCD、Master）×3 |
| ubuntu14 / 15 / 16 / 17 | 10.10.3.14~17 | 8c / 16g / 200G | Worker ×4 |
| ubuntu18 | 10.10.3.18 | 8c / 16g / 500G | Harbor（镜像仓库） |
| ubuntu19 | 10.10.3.19 | 8c / 16g / 200G | GitLab（gitlab.internal，代码托管） |
| ubuntu20 | 10.10.3.20 | 8c / 16g / 100G | K3S + Rancher（管理面） |

- 虚拟化底座：VMware vSphere（vCenter：10.20.22.10，物理机 10.20.22.1~3，虚拟机按物理机资源占用分布；跳板机 bastion 走 10.20.201.x 网段）。
- **真实踩坑（主动讲是加分项）**：2024.09.30 因物理机内存不足，把 ubuntu13~17 的内存从 16G 降到 8G——物理机资源是硬约束，集群规格会被迫收敛，这也是"简历数字 vs 实际规模"差异的根源之一。

**环境 B（早期架构，2024.01 基础环境，仓库 231221_setup.md）**：bastion + harbor + rancher(k3s) + RKE2 集群（3 控制节点 + 2 工作节点）；建机两种方式——Terraform 批量建 9 台，或 Rancher 通过 vSphere API 自动建 5 台（官方推荐后者）。

**关键版本清单（版本号要背准，追问时脱口而出）：**

| 组件 | 版本 |
|---|---|
| RKE2 | v1.30.8+rke2r1 |
| K3S | v1.30.3+k3s1（airgap 镜像包 `k3s-airgap-images-amd64.tar.zst` 安装） |
| Rancher | v2.10.2（helm 安装，通过 cluster api 管理集群） |
| Harbor | v2.12.2（官方 `harbor-offline-installer-v2.12.2.tgz`） |
| Cert-manager | v1.17.0 |
| ITSM GitOps 环境（项目仓库） | GitLab 16.8.1 / GitLab Runner 16.8.0 / Harbor 2.10.0 / ArgoCD 2.9.5（GitLab 经 helm 部署，域名 gitlab.internal） |
| 2024.01 基础环境（项目仓库） | K3S v1.26.11+k3s2 / Rancher 2.7.9 / Cert-manager v1.12.7 / kubectl 1.29.1 / helm 3.14.0 |
| 离线交付环境（早期 airgap 文档） | Harbor v2.11.1 / Rancher v2.9.2 / Cert-manager v1.15.3 / RKE v1.30.4+rke2r1 |

### 3.3 基础设施即代码（IaC）

- **两套 Terraform 写法都做过**：
  - `esxi` provider 版（automation 仓库）：在 ESXi（10.20.80.140）上批量建机，`esxi_guest` 资源 + `for_each` 按规格清单批量建、thin 磁盘、`noble-server-cloudimg-amd64.ova`（Ubuntu 24.04）模板、cloud-init 经 `guestinfo`（gzip+base64）注入主机名/SSH key/软件包/时区。
  - `vsphere` provider 版（项目仓库）：连 vCenter（10.20.22.10），`vsphere_virtual_machine` 资源按物理机分组（变量文件：10.20.22.1 建 13~17、10.20.22.2 建 11~12、10.20.22.3 建 18~20），双网卡（inner_pg 10.10.3.x + vlan201 10.20.201.x）、双磁盘（系统盘 + sdb 数据盘 thin）、`guestinfo.metadata/userdata`（base64）注入 cloud-init。
- **cloud-init 注入内容**：主机名/fqdn、SSH 公钥、清华 apt 源、软件包（curl/vim/git/wget/lvm2/resize2fs/libpam-google-authenticator）、用户（sudo NOPASSWD）、时区 Asia/Shanghai、NTP。
- **Ansible 批量初始化**（containerization 仓库 scripts/ansible）：免密登录、挂盘（parted + ext4 + mount /mnt/sdb1）、LVM 扩容系统盘（lvol resizefs）、禁用 cloud-init 重置 netplan、批量写 /etc/hosts、CA 证书导入（update-ca-certificates）。

### 3.4 存储方案（Longhorn）

- 用 Helm 部署 Longhorn（`helm repo add longhorn https://charts.longhorn.io`，`helm install longhorn longhorn/longhorn -n longhorn-system`），也在 Rancher 的 Apps→Charts 里安装过。
- Longhorn 是 Kubernetes 原生的分布式块存储：把各节点本地磁盘组织成存储池，通过 CSI 驱动提供 PVC 动态供给。**副本数按 worker 节点数设置（≤ worker 数量）**，磁盘不够时在 Longhorn UI 上给节点加盘。
- 安装后自带默认 StorageClass，PVC 不指定 `storageClassName` 即走 Longhorn。实例：nginx 的 `nginx-logs-pvc`（RWO，1Gi，挂载 /var/log/nginx）、ES 的 volumeClaimTemplate（RWO，5Gi）。
- 支撑有状态应用容器化迁移：PVC 独立于 Pod 生命周期，Pod 重建/漂移数据不丢。
- 对象存储规划过 MinIO（GitLab 外部对象存储场景），当时评估暂不必要未装。

### 3.5 中间件服务容器化（MySQL / ES / Redis，CMDB 迁移的依赖底座）

> 来自 ITSM 迁移计划 Stage 3（240227 文档），CMDB 迁移直接复用。

- **MySQL 8.0**：helm 安装 bitnami/mysql（9.23.0，standalone），自定义 my.cnf 经 ConfigMap 注入（**关键细节**：去掉 sql_mode 里的 NO_ZERO_IN_DATE/NO_ZERO_DATE，保证导入 '0000-00-00 00:00:00' 老数据不报错），数据卷走 Longhorn PVC。
- **Elasticsearch 7.x**：helm 安装 elastic/elasticsearch（7.17.3，单节点，antiAffinity soft，volumeClaimTemplate RWO 5Gi）；**CMDB 需要中文分词插件**——按官方做法基于同版本 ES 镜像自定义 Dockerfile 装插件，再配 imagePullSecrets 从 Harbor 拉私有镜像。
- **Redis**：helm 安装 bitnami/redis（18.19.2，standalone，--set auth.password）。
- **kkFileView**（ITSM 在线预览）：Artifact Hub 没有该 chart，手写 deployment/service/configmap manifest（镜像 keking/kkfileview:4.1.0，端口 8012，application.properties 经 ConfigMap 注入）。

### 3.6 CI/CD 工具链

- **主链路：GitLab 16.8.1 + GitLab Runner 16.8.0（containerization 仓库，印证简历"GitLab代码托管、GitLab Runner流水线执行器"）**：
  - GitLab 用 helm 部署（gitlab/gitlab chart，域名 gitlab.internal，domain=internal，ingress 用 nginx、复用 gitlab-tls-secret 证书）；Runner 用 gitlab-runner chart + runner-values.yaml：executor=kubernetes、privileged、host_aliases 指向 gitlab/harbor（内网无 DNS）、certsSecretName=gitlab-runner-ca 解决证书信任。
  - **ITSM/CMDB 流水线（parent + child pipeline，真实脚本 scripts/ITSM）**：parent 只在 `release.txt` 版本号变更且分支为 main 时通过 `trigger: include` 触发对应的 child；child 三个 stage——build（maven 打包 war → ROOT.war）、image（docker:25 + dind，登录 Harbor 构建推送）、manifest（用 yq 改部署清单里镜像 tag + podAnnotations date 时间戳强制滚动更新，commit 带 `[skip ci]` 避免再次触发 CI）。
  - **push-options `[skip ci]` 技巧**：manifest 镜像更新提交不触发 CI，防止 CI/CD 死循环。
  - 前后端分离部署：itsm-web（nginx chart 承载前端）、itsm-saas（tomcat chart 承载后端 war）。
- **Harbor 私有仓库**：两种部署方式都做过——①helm 部署（harbor-values.yaml：externalURL https://harbor.internal、certSource=secret 用 cert-manager 签的 harbor-tls-secret、metrics serviceMonitor）；②离线安装包独立节点部署（v2.12.2，harbor.yml 自签证书，500G 磁盘）。K3S/containerd 通过 `/etc/rancher/k3s/registries.yaml` 配 mirror 拉私有镜像。
- **另一套环境（automation 仓库，Gitea + Jenkins）**：Gitea + Gitea Runner（act_runner，挂载宿主机 docker.sock）+ Jenkins（helm 安装）——Jenkinsfile 五阶段：检查工具 → 拉代码 → yq 改 `argocd_yaml/base/nginx-deployment.yaml` 镜像 tag → push 回 Gitea → docker build → docker push Harbor → 清理本地镜像。**思路与 GitLab 完全一致：CI 只改 Git 清单，Argo CD 感知后自动部署。**
- **监控**：Prometheus + Grafana（Rancher Cluster Tools 安装），导入 Harbor / ArgoCD / Runner / MinIO 官方 dashboard（Grafana id：14075 / 14584 / 9631 / 13502）。

### 3.7 GitOps 持续交付（Argo CD + Cert-Manager）

- **GitOps 文档原话（240204_gitops.md，可直接引用）**："该环境所有应用全部容器化部署在同一个 Kubernetes 集群中"——这是"100% 容器化"最直接的文档支撑。
- Argo CD 作为 CD 端：Application 关联 Git 仓库（ITSM 项目一个 Application 监听 4 个目录：deploy/tomcat、deploy/nginx、deploy/customize、deploy/kkfileview；另一套 nginx demo 用 kustomize 目录 argocd_yaml/base），syncPolicy 开 `automated: prune + selfHeal`，同步间隔设为 10s。
- 发布闭环：开发 push 代码（只改代码 + release.txt 版本号）→ CI 构建镜像推 Harbor → CI 用 yq 改部署清单镜像 tag（提交带 `[skip ci]`）→ Argo CD 感知仓库变化 → 自动 sync → Pod 滚动更新（liveness/readiness 探针，httpGet /，initialDelay 10s / period 5s）。
- Cert-Manager v1.17.0：`ClusterIssuer(cluster-issuer)` 基于私有 CA（`secretName: rancher-ca`，CA 取自 Rancher 自带的 `tls-rancher` 证书）为所有服务签发证书；Ingress 加注解 `cert-manager.io/cluster-issuer: cluster-issuer` 自动出证，全站 HTTPS。

### 3.8 离线部署方案（核心交付能力）

分四层，每层都有对应素材：

1. **系统层**：Docker 五个 deb 包（containerd.io / docker-ce-cli / docker-ce / buildx / compose-plugin）按顺序 `dpkg -i`；GitLab 用 `apt-get install --download-only` 拉全依赖离线安装。
2. **K8s 层 airgap**：`k3s-airgap-images-amd64.tar.zst` 放到 `/var/lib/rancher/k3s/agent/images/`，`k3s` 二进制放 `/usr/local/bin/`，`INSTALL_K3S_SKIP_DOWNLOAD=true ./install.sh` 离线安装；RKE2 同理用离线镜像包。
3. **应用镜像层（6 步脚本）**：①从 yaml 提取镜像名（`repository:`/`tag:` → images.tmp）②联网拉取到中转机 ③生成 Harbor 命名的新列表（加前缀 `10.10.3.18/` → new_images.tmp）④重新打 tag ⑤推送 Harbor ⑥清理本地镜像；另有 `all_in_one.sh` 菜单化合并全部功能。
4. **Helm 层**：cert-manager CRD + chart tgz、rancher tgz、argo-cd tgz、gitlab-runner tgz 全部本地安装，镜像预先灌入 Harbor；业务侧还用了 airgap 的 bitnami tomcat/nginx chart（Chart.lock + charts 目录离线打包，ITSM 部署即此方式）。

私有仓库配置：`/etc/rancher/k3s/registries.yaml`（mirrors + configs.auth + configs.tls）；证书信任：CA 导入 `/usr/local/share/ca-certificates/` + `update-ca-certificates`，containerd registry 单独配 `ca_file`。

> 注意：三套环境的组件版本不同（2024.01 基础环境：K3S v1.26.11+k3s2 / Rancher 2.7.9 / cert-manager 1.12.7；ITSM GitOps 环境：GitLab 16.8.1 / Runner 16.8.0 / Harbor 2.10.0 / ArgoCD 2.9.5；新环境：RKE2 v1.30.8+rke2r1 / Rancher 2.10.2 / Harbor 2.12.2 / cert-manager 1.17.0），回答时按"哪个环境哪个版本"讲，别混。

---

## 四、负责内容

- 【主导】容器化改造整体方案设计：服务盘点、依赖关系梳理、资源规划、迁移路径与里程碑。
- 【主导】高可用 Kubernetes 架构设计与部署：K3S 开发测试环境、RKE2 生产集群、Rancher 多集群纳管（cluster api）、节点批量初始化（Terraform + Ansible）。
- 【主导】CI/CD 工具链搭建：Harbor 私有仓库、GitLab/Gitea 代码托管、GitLab Runner / Gitea Runner / Jenkins 流水线，实现"代码提交→镜像构建→仓库更新"自动化。
- 【主导】Argo CD GitOps + Cert-Manager 发布体系：GitOps 闭环设计、探针/滚动更新配置、全站 HTTPS 证书自动化。
- 【独立】离线部署方案：四层离线化设计、镜像搬运 6 步脚本、airgap 安装文档、私有仓库与证书配置。
- 【独立】Terraform IaC 批量建机、Ansible 批量初始化与 CA 导入。
- 【独立】运维文档与安全加固：全站 HTTPS、LVM 扩容根分区、Linux 2FA（libpam-google-authenticator）、文件系统与日常运维手册。
- 【参与】Longhorn 存储选型与部署、有状态服务（数据库/缓存/日志类）容器化迁移的落地配合。
- 【参与】中间件容器化落地：MySQL/ES/Redis 的 helm 部署与配置（my.cnf、ES 分词插件自定义镜像、Redis 密码化）、kkFileView 手写 manifest——与开发同事（团队同事、团队同事等负责业务侧容器化）协作确认服务清单与版本。

---

## 五、完成成效（量化结果 + 度量方式）

> 面试官最看重"数字怎么来的"。所有数字后面都跟一句"怎么度量的"，这是加分点。

|---|---|---|
| 100% 服务容器化 | CMDB/ITSM 业务服务（Tomcat 前后端，及 MySQL/Redis/ES/kkFileView 等依赖组件）全部以容器方式运行在 K8s 集群 | 服务清单逐项核对 + `kubectl get pods -A` 全部 Running + Harbor 镜像与部署清单一一对应 |
| 多集群统一管理 | 一套 Rancher 控制台管理开发测试与交付多套集群 | Rancher UI / cluster api 纳管状态 |
| 全站 HTTPS 自动化 | 所有对外服务统一 https，证书自动签发 | cert-manager Certificate/Ingress 注解生效，浏览器/客户端无证书告警 |
| 离线交付能力 | 无外网机房可用"离线包 + 脚本"完整部署 Harbor/K3S/Rancher/应用 | 按离线手册从零部署演练，全程不需要外网 |
| 环境交付提速 | IaC 使环境重建从手工数天缩短到小时级 | Terraform 批量建机 + cloud-init 自动初始化耗时 |

**附加收益（可口头补充）**：环境一致性（镜像即环境）、发布回滚更快（Git 历史 + Argo CD 一键回滚）、资源利用率提升（多服务共享节点）、交付方案可复制（文档 + 脚本 + IaC）。

---

## 六、面试官提问与参考回答

### 第一组：基础问题（5 题）

#### Q1. 请用一两分钟介绍一下这个项目。

- 【面试官意图】考察整体表达、项目在你心中的主线是否清晰；同时给面试官一个追问的地图。
- 【参考回答】这是我们给客户交付的 CMDB 系统的容器化改造项目，周期大约半年。业务背景是这套系统原来是 Tomcat + MySQL + Elasticsearch 的传统架构，跑在虚拟机上，环境不一致、手动发布慢，而且客户机房没有外网，交付部署非常吃力。我主导了整体方案：用 K3S 搭开发测试环境、RKE2 搭生产级集群、Rancher 统一管理；自建 Harbor 仓库，用 GitLab 加 GitLab Runner 打通 CI/CD，Argo CD 做 GitOps 自动发布，Longhorn 解决持久化存储，MySQL/ES/Redis 中间件容器化，Cert-Manager 做证书自动化；最后把整套做成离线交付方案，包括镜像搬运脚本和离线安装包。结果上业务服务 100% 容器化，单次发布从 30 分钟压到 12 分钟左右，部署效率提升约 60%。（另一套新环境我还搭过 Gitea + Jenkins 的轻量组合，思路一致。）
- 【追问】
  - 追问：你最自豪/最难的一点是什么？答：离线交付。所有镜像、依赖、安装包都要提前准备，还要保证内网私有证书体系能闭环，任何一环断掉整套就装不起来；我们最后用脚本把镜像搬运做成了 6 步一条命令，现场照着文档就能装。
  - 追问：如果重来一次，哪里会改进？答：前期服务盘点可以更早开始，先做依赖梳理再规划集群规格，避免后期补资源。
- 【岗位侧重】通用（所有岗位必答）

#### Q2. 什么是 CMDB？为什么要容器化？不容器化会怎样？

- 【面试官意图】验证你是真做过还是背简历；同时考察对"为什么做"的理解深度。
- 【参考回答】CMDB 就是配置管理数据库，把服务器、网络设备、软件、业务依赖这些配置项和关系统一登记，是运维自动化的数据底座。改造前这套系统直接跑在虚拟机上，每台机器环境手工装，发布靠人肉操作，dev/test/prod 经常配置漂移；而且客户机房没外网，交付部署要几天。容器化以后环境就是镜像本身，一处构建处处运行，发布走流水线，扩容就是加副本，交付变成拷镜像、导离线包，这是传统虚拟机方式做不到的。
- 【追问】
  - 追问：容器化最大的风险是什么？答：有状态的部分，数据库、缓存、日志这类带数据的服务，所以专门部署了 Longhorn 做持久化存储，PVC 和 Pod 生命周期解耦。
  - 追问：为什么不直接用云托管 K8s？答：客户环境是 ESXi 私有化机房且无外网，云托管不适用，必须自建。
- 【岗位侧重】通用 / 技术支持

#### Q3. 你们集群整体架构是怎样的？节点怎么规划的？

- 【面试官意图】考察对架构细节的掌握——是不是真搭过，还是只会背术语。
- 【参考回答】我们实际有三套环境。开发测试环境在 10.20.80 网段，一共 5 台：一台 4 核 8G 的节点跑 Rancher（K3S），一台 8 核 8G 500G 的节点跑 Harbor，一台 8 核 16G 的 master 带两个 8 核 16G 的 worker。交付/生产环境在 10.10.3 网段，2024.09.19 的配置是：3 个控制节点（ubuntu11~13，8c16g100G）、4 个工作节点（ubuntu14~17，8c16g200G），加独立的 Harbor（8c16g500G）、GitLab（8c16g200G）、K3S+Rancher（8c16g100G）节点，跑在 vSphere 上，vCenter 是 10.20.22.10。更早 2024.01 的基础环境是 3 控制 + 2 工作节点的 RKE2。节点规格是按组件需求定的——Harbor 吃磁盘所以 500G，控制面吃内存所以 16G；后来物理机内存不够，还把部分节点从 16G 降到 8G 过，资源约束是真实存在的。
- 【追问】
  - 追问：master 单节点怎么保证高可用？答：开发测试环境 master 是单节点，够用；交付环境是 3 控制节点 etcd 集群，3 节点可以容忍挂 1 台（多数派）。HA 的关键就是控制面多节点 + etcd 多数派。
  - 追问：worker 节点上跑了哪些服务？答：业务服务（tomcat/nginx）、存储（Longhorn 数据副本）、Runner 这类 CI 组件。
- 【岗位侧重】通用 / 运维

#### Q4. 你在项目里的角色和具体职责？哪些是你独立完成的？

- 【面试官意图】判断你的真实贡献度，区分"主导"和"参与"。
- 【参考回答】我是这个项目方案的主要设计者和落地执行人。主导了整体容器化方案、集群架构部署、CI/CD 工具链和 GitOps 发布体系；独立完成了 Terraform 批量建机、离线镜像搬运脚本和全套离线安装文档、证书体系；Longhorn 存储和有状态服务的迁移是和开发同事一起落地的。职责上我偏基础设施与交付链路这一层——从虚拟机、集群、仓库、流水线到证书，都是我一个人串起来的。
- 【追问】
  - 追问：有没有和团队协作踩过坑？答：服务盘点时发现有的服务依赖老版本组件，和开发确认后才定镜像版本，所以离线镜像列表是反复核对过的。
  - 追问：你独立完成的东西里，哪个最有技术含量？答：离线方案，因为它是整套系统能交付的前提。
- 【岗位侧重】通用

#### Q5. 从一次代码提交到用户访问，完整链路走一遍。

- 【面试官意图】考察对 CI/CD 全链路的真实理解，DevOps 岗必考；面试官会顺着每一环追问。
- 【参考回答】以我们 ITSM/CMDB 这条 GitLab 流水线为例：开发只改代码和 release.txt 版本号，push 到 main 分支。parent pipeline 检测到版本文件变更，通过 trigger 调用对应 child pipeline——child 三个阶段：build 用 maven 打 war 包，image 用 docker:dind 构建镜像推到 Harbor，manifest 用 yq 把部署清单里的镜像 tag 改成新版本、并加一个时间戳注解强制滚动更新，这个提交带 `[skip ci]` 不会再次触发 CI。Argo CD 的 Application 监听部署目录，检测到清单变化就自动 sync，Pod 从 Harbor 拉新镜像滚动更新，liveness/readiness 探针就绪后接入流量。整个是"CI 改清单、CD 感知清单"的 GitOps 闭环——CI 永远不直接碰集群。另一套 Gitea/Jenkins 环境也是同一套思路，Jenkinsfile 用 yq 改完清单推回 Git，Argo CD 自动同步。
- 【追问】
  - 追问：Argo CD 和 kubectl apply 有什么区别？答：Argo CD 以 Git 为唯一事实来源，集群状态漂移会被检测并拉回 Git 状态，还能看同步历史和一键回滚；kubectl apply 是手工操作，没有状态比对和审计。
  - 追问：镜像 tag 用什么？答：我们的 CI 用 release.txt 里的版本号作为 tag（如 v2.4），配套 [skip ci] 防止 manifest 提交再触发流水线；另一种写法是 BUILD_NUMBER 或 commit SHA，生产更推荐 commit SHA 保证可追溯。
- 【岗位侧重】DevOps / 运维

---

### 第二组：深入问题（7 题）

#### Q6. K3S 和 RKE2 有什么区别？为什么开发测试用 K3S、生产用 RKE2？

- 【面试官意图】考察你对 Kubernetes 发行版的理解深度——只背过名字和真懂区别是两回事。
- 【参考回答】两者都是 Rancher 出品的 K8s 发行版。K3S 是轻量级的，单二进制、默认用 SQLite/etcd 可选、资源占用小，适合边缘、开发和测试环境，我们的 Rancher 管理端就放在 K3S 上；RKE2 是 RKE 的下一代，走 CIS 加固基线，默认 containerd、默认 etcd、更接近"生产安全标准"，所以生产集群用 RKE2。简单说就是 K3S 轻、快、省资源，RKE2 稳、安全、适合生产。另外两者都支持离线 airgap 安装，这也是我们选型时的硬性条件。
- 【追问】
  - 追问：RKE2 高可用怎么搭？答：多控制节点共用一个外部 etcd 或内嵌 etcd 集群，控制面前面加负载均衡，worker 节点 join 进来；3 个控制节点可以容忍 1 台故障。
  - 追问：K3S 的 etcd 和 SQLite 模式怎么选？答：单节点用 SQLite 就行，需要 HA 就上 etcd；我们开发测试环境单控制面，用的默认模式。
- 【岗位侧重】运维 / DevOps

#### Q7. Rancher 怎么管理多套集群？导入集群的原理是什么？agent 连不上怎么办？

- 【面试官意图】简历写了"Rancher 多集群统一管理"，这是必追的；考察是真用过还是只装过。
- 【参考回答】Rancher 通过 cluster api 纳管集群：Rancher 所在集群作为管理面，目标集群里装上 cattle-cluster-agent 反向连回 Rancher，之后对集群的增删改查都通过这个 agent 通道走。我们开发测试环境和交付环境都纳管在同一个 Rancher 控制台下，UI 上就能看节点、部署应用、管理证书。我踩过的坑是 agent 一直 waiting for cluster agent to connect，最后是把 agent 的 dnsPolicy 改成 Default，并加上 hostAliases 把 rancher 域名指到 Rancher 节点 IP 解决的——内网没 DNS，域名解析全靠 /etc/hosts 或 hostAliases。
- 【追问】
  - 追问：agent 连不上还有哪些可能原因？答：证书不信任（x509 报错）、网络不通、域名解析不到；排查顺序一般是看 agent Pod 日志 → 验证 Rancher 域名在集群内能否解析 → 检查证书链。
  - 追问：Rancher 本身坏了会影响业务吗？答：不会，Rancher 只是管理面，业务集群照常运行；这也是设计上把管理面和数据面分离的好处。
- 【岗位侧重】运维

#### Q8. Harbor 私有仓库怎么配？K3S/containerd 怎么拉私有仓库镜像？

- 【面试官意图】私有仓库是这套体系的枢纽，面试官要确认你会配 mirror、会处理证书、懂拉取鉴权。
- 【参考回答】Harbor 用官方离线安装包装，配置在 harbor.yml，hostname 是 harbor.internal，HTTPS 用自签证书，装完用 docker login 验证。集群侧关键是给 containerd 配 registry：K3S 里改 /etc/rancher/k3s/registries.yaml，把 docker.io 的 mirror 指到我们的 Harbor，同时在 configs 里配 Harbor 的账号密码和 TLS 证书（cert/key/ca），重启 k3s 生效。Pod 拉私有镜像还需要 imagePullSecrets：用 kubectl create secret docker-registry 在命名空间建好，deployment 里引用，或者靠 registries.yaml 的 mirror 让 containerd 直接转发。我们两种方式都用过，集群组件走 mirror，业务应用走 imagePullSecrets。
- 【追问】
  - 追问：registries.yaml 配了 mirror 为什么有时还报 image pull 失败？答：常见三种——证书没配（containerd 不认 Docker 的 certs.d）、auth 信息错、域名解析不到；用 `k3s ctr images pull` 手动测一下就知道是哪层。
  - 追问：Harbor 的复制/回收策略配了吗？答：垃圾回收按官方定时清 untagged 镜像；跨集群复制没做，因为离线环境用离线包导入。
- 【岗位侧重】运维 / DevOps

#### Q9. Longhorn 是什么？和 StorageClass 什么关系？有状态应用怎么迁移？RWO/RWX、备份怎么做？

- 【面试官意图】简历写了"Longhorn + StorageClass 动态存储供给"，必被追问；考察是否真懂存储，这是区分运维深浅的题。
- 【参考回答】Longhorn 是 Kubernetes 原生的分布式块存储，用各节点本地磁盘组成存储池，通过 CSI 驱动动态供给 PV，默认 3 副本保证数据安全。安装后它自带一个默认 StorageClass，PVC 不指定 storageClassName 就会走它，我们 nginx 的日志 PVC（1Gi，RWO）就是例子——Pod 重建后数据还在，这就是"有状态应用能容器化"的基础。访问模式上我们主要用 RWO（单节点读写），Longhorn 也支持 RWX（走 NFS share-manager），多 Pod 共享场景可以用。备份我们规划用 Longhorn Backup 打到外部存储，做异地容灾；卸载排障我也踩过坑，命名空间删不掉要清 finalizers、webhook、CRD，官方那套 deleting-confirmation-flag 流程我整理成文档了。
- 【追问】
  - 追问：RWO 和 RWX 什么区别？什么时候用 RWX？答：RWO 同一时刻只能一个节点挂载，适合数据库、日志这类单写者；RWX 多个节点同时读写，适合共享文件、多副本 web 应用的共享目录；Longhorn 的 RWX 是通过内置 NFS server 实现的。
  - 追问：副本数为什么默认 3？答：兼顾可用性和磁盘开销，3 副本挂 1 块盘数据不丢；磁盘紧张的环境可以降到 2，这是 StorageClass 参数。
- 【岗位侧重】运维 / DevOps

#### Q10. Argo CD 的 GitOps 是怎么闭环的？CI 怎么和 CD 联动？出问题怎么回滚？

- 【面试官意图】简历写了"Argo CD GitOps + 部署效率提升 60%"，DevOps 岗必考闭环设计。
- 【参考回答】闭环的关键是"CI 只改清单，不碰集群"。以我们的 Jenkinsfile 为例：构建镜像推 Harbor 后，流水线用 yq 把 argocd_yaml/base/nginx-deployment.yaml 里的镜像 tag 改成新版本，commit 并 push 回 Git 仓库；Argo CD 的 Application 指向这个仓库（kustomize 目录），检测到变更自动 sync，把清单应用到集群，Pod 滚动更新，探针就绪后接流量。回滚也简单：Git 历史里 checkout 旧版本推上去，或者 Argo CD UI 里直接回退到上一个同步点，比手工 kubectl 靠谱，因为集群状态永远和 Git 对齐，漂移会被自动拉回。
- 【追问】
  - 追问：自动同步和手动同步怎么选？答：测试环境开自动，生产建议半自动（先看 diff 再 sync），避免坏版本自动上线；我们演示环境用的是自动同步，间隔设成 10s。
  - 追问：CI 改 manifest 会不会又触发一次 CI？答：不会，manifest 更新提交带 `[skip ci]`（push-option），GitLab 会跳过这次触发，这是防 CI/CD 死循环的关键。
  - 追问：探针挂了会怎样？答：readiness 不过就不进 service 端点，liveness 不过就重启容器，配合滚动更新策略可以做到发布不中断。
- 【岗位侧重】DevOps

#### Q11. 离线部署具体怎么做？镜像怎么搬运的？

- 【面试官意图】简历写了"全套离线部署方案"，这是你简历里最"硬"的一条，面试官会挖细节验证真实性。
- 【参考回答】离线分四层做。第一层系统依赖：Docker 的 5 个 deb 包按顺序 dpkg -i，GitLab 用 apt download-only 把依赖全拉下来；第二层 K8s airgap：K3S 的 airgap 镜像包放到 agent/images 目录，用 INSTALL_K3S_SKIP_DOWNLOAD=true 离线装；第三层应用镜像，是我写的 6 步脚本：先从 yaml 里提取镜像名，在联网的中转机上拉取，生成带 Harbor 前缀的新列表，重新打 tag，推送到 Harbor，最后清理本地镜像，全流程也可以一条命令走 all_in_one.sh 菜单；第四层 Helm chart：cert-manager、Rancher、Argo CD、GitLab Runner 的 tgz 和 CRD 全部本地安装，镜像预先灌进 Harbor。现场部署就是导离线包 + 跑脚本，全程不需要外网。
- 【追问】
  - 追问：镜像列表怎么保证不漏？答：从 Helm values/部署 yaml 里提取 repository 和 tag 成对生成，逐条核对，工具链的镜像（如 cert-manager、Rancher、Runner）单独从官方 values 提取，这是最容易漏的地方。
  - 追问：中转机拉了镜像再推 Harbor，为什么不用 skopeo？答：当时环境用 docker save/load 和 tag/push 脚本已经能闭环，优先用团队熟悉的方式，工具选型上 skopeo 是备选。
- 【岗位侧重】运维 / 技术支持 / DevOps

#### Q12. 证书体系怎么搭的？Cert-Manager 和私有 CA 的关系？

- 【面试官意图】简历写了"Cert-Manager 自动证书管理"，考察证书链路的真实理解——这是内网部署最脏最坑的一环。
- 【参考回答】我们的证书体系是"私有 CA + Cert-Manager 统一签发"。CA 来源是 Rancher 自带的证书：把 Rancher 的 tls-rancher secret 导出来，在 cert-manager 命名空间建一个 rancher-ca 的 TLS secret，然后定义一个 ClusterIssuer 指向它；之后任何服务只要建一个 Certificate 资源（声明域名），Cert-Manager 就用这个 CA 自动签发证书放到 secret，Ingress 加注解 cert-manager.io/cluster-issuer 就能自动挂上 TLS。Harbor 特殊一点，它不在集群里，先用 openssl 手工自签让它能跑起来，等 cert-manager 就绪后用签发的子证书替换，改 harbor.yml 证书路径后 ./prepare 重建。全站 HTTPS 就是靠这套自动化，不用手动管证书。
- 【追问】
  - 追问：证书链上有哪些坑？答：最常见是 x509 unknown authority——所有节点要把 CA 导进 /usr/local/share/ca-certificates 并 update-ca-certificates，containerd 还要单独配 ca_file；另外 Docker 客户端要放 /etc/docker/certs.d/<域名>/ 目录；内网没 DNS 还要配 hostAliases，否则报 No such host。
  - 追问：证书到期怎么办？答：Cert-Manager 自动续期，Certificate 资源有 duration/renewBefore 控制；我们签发时长给的比较长（如 3650 天/7860 小时），内网环境够了。
- 【岗位侧重】运维 / DevOps / 技术支持

---

### 第三组：刁钻 / 压力问题（5 题）

#### Q13. 简历写"3 控制节点 + 5 工作节点"，但我看你文档里是 1 个 master + 2 个 worker，到底多大？

- 【面试官意图】压力测试：考察你面对简历与事实的出入，是心虚否认还是从容解释；同时看你是否真懂多套环境的区别。
- 【追问】
  - 追问：那你这个"生产级"到底在哪个环境验证的？答：高可用设计（3 控制节点 etcd 多数派、探针、滚动更新、镜像回滚）在交付环境按文档部署验证过；开发测试环境跑日常业务验证。
- 【岗位侧重】通用

#### Q14. 部署效率提升 60% 是怎么算出来的？数据从哪来？

- 【面试官意图】考察数字是否经得起推敲——简历上最容易被挑战的就是百分比。
- 【追问】
  - 追问：30 分钟里最耗时的环节是什么？答：传包和重启验证，手动的步骤多、等待多；流水线把中间等待都省了。
  - 追问：为什么不是更快？答：流水线耗时大头在构建——文档实测后端 build 阶段就要 7~8 分钟（maven 打 war），加上推镜像、改清单、Argo 同步和滚动更新，端到端 9 分半到 12 分钟是真实的，不含水分。
- 【岗位侧重】通用 / DevOps

#### Q15. "100% 服务容器化"——总共多少个服务？怎么验证？有没有例外？

- 【面试官意图】简历写"100%"这种绝对化表述必被挑战，考察范围定义和诚实度。
- 【参考回答】这里的"100%"指 CMDB 业务服务这个范围：前端、后端 API、定时任务，以及配套的数据库、缓存这些有状态组件，全部以容器方式跑在集群里，按服务清单逐项核对过，kubectl get pods -A 全部 Running，Harbor 里的镜像和部署清单一一对应。例外是有的，基础设施和管理面不算在内——ESXi 宿主机、Harbor 仓库本身、Rancher 管理端这些是运行 K8s 的前提，不算"业务服务"。具体数量以部署清单为准，我记得迁移的服务（含组件）在二三十个镜像、十多个工作负载这个量级，不是几十上百个服务的大系统。
- 【追问】
  - 追问：数据库也容器化了，生产环境你敢把数据库放容器里？答：MySQL/ES 是用 Helm 部署在集群里、数据走 Longhorn PVC（MySQL 8.0 是 bitnami/mysql 单实例 + my.cnf 定制，ES 7.17.3 单节点 + 5Gi 数据卷），Pod 挂了数据不丢；数据库容器化在当时场景下是权衡过的——离线交付要求统一环境，容器加持久化卷比在虚拟机里裸装更可控，同时配套了备份方案。
  - 追问：怎么证明"全部"？答：服务清单 + Harbor 仓库 + 集群资源三面对账，这是一次性的核对结论，不是凭感觉。
- 【岗位侧重】通用 / 运维

#### Q16. 你简历写 GitLab 代码托管、GitLab Runner 流水线执行器，实际仓库里怎么还有 Gitea + Jenkins？

- 【面试官意图】考察工具链真实性和区分能力——简历与仓库素材对不上时，是慌还是能说清"哪套环境用什么"。
- 【参考回答】GitLab 和 GitLab Runner 是真实的主链路，项目文档里 GitLab 实例是 gitlab.internal（GitLab 16.8.1 + Runner 16.8.0），CMDB/ITSM 的流水线就是在这上面跑的——parent/child pipeline，maven 打包、docker:dind 推 Harbor、yq 改清单、[skip ci] 防死循环，这套我都能讲细节。仓库里看到的 Gitea + Jenkins 是**另一套环境**（automation 仓库），我后来在新环境里搭的轻量组合，Jenkinsfile 的思路和 GitLab CI 完全一致，都是"构建→推 Harbor→改 Git 清单→Argo CD 同步"。所以是两套环境两套工具链，简历写 GitLab 是主链路，Gitea/Jenkins 是补充。
- 【追问】
  - 追问：GitLab 和 Jenkins 你更推荐哪个？答：一体化体验 GitLab CI 更好（代码、流水线、仓库在一起）；Jenkins 插件生态全、可控性强，但要自己维护。我们按环境选，不强求统一。
  - 追问：Runner 挂 docker.sock 有什么风险？答：等于给了 Runner 宿主机的 Docker 权限，安全上要控制 Runner 只跑可信仓库的任务；更隔离的方案是 dind 或 Kubernetes executor——我们 GitLab Runner 用的就是 Kubernetes executor + privileged，隔离性更好。
- 【岗位侧重】DevOps / 运维

#### Q17. 生产级集群用自签证书和内网私有域名，安全怎么过关？这算生产级吗？

- 【面试官意图】压力测试：挑战你简历里"生产级"的说法，考察安全意识和诚实度。
- 【参考回答】先说明背景：客户环境是隔离内网、无外网，公网 CA 根本不会给内网私有域名签发证书，所以私有 CA 是这类场景的标准做法，不是偷懒。我们的做法是私有 CA + Cert-Manager 统一签发，全站 HTTPS，证书到期自动续期，避免手工维护。至于"生产级"的定义，我认为核心在可用性和流程：etcd 多节点、探针、滚动更新、Git 化发布和回滚、存储多副本、离线可恢复，这些是生产级的硬指标；证书策略上，正式投产前我会补 CA 私钥的保管与备份、有效期监控，如果客户要求也可以对接他们的企业 CA，把我们的自签 CA 换成企业签发的证书，替换链路我们已经验证过了。
- 【追问】
  - 追问：如果客户审计问证书，你怎么答？答：内网私有 CA 加统一签发是隔离环境的合规做法，提供 CA 证书和信任链文档，必要时对接客户 CA 体系。
  - 追问：还有什么安全短板你心里清楚但没做？答：Runner 挂 docker.sock 的权限偏大、部分服务没有做网络策略（NetworkPolicy）、镜像没跑漏洞扫描——这些是明确知道的改进项，投产前要排进去，我不回避。
- 【岗位侧重】通用 / 运维 / 技术支持

---

## 附：面试黄金法则（临场提词）

2. **多套环境、多套工具链都是真实情况**：250303（1+2 测试）/ 240919（3 控制 + 4 工作 + 3 服务节点）/ 231221（3+2 早期），GitLab 主链路 + Gitea/Jenkins 补充——主动拆开讲比被问出来强一百倍。
3. **范围定义**："100%"、"全部"这类词先引用 GitOps 文档原话再定义范围。
4. **诚实收窄**：没做深的东西（StorageClass 调优、备份落地、安全扫描）直说"没做深/是规划项"，并补一句"改进方向是什么"——面试官要的是成熟度，不是完美。
5. **把战场引到素材最全的地方**：GitLab 流水线（parent/child + [skip ci]）、ITSM 迁移四阶段、中间件容器化（MySQL my.cnf / ES 分词插件 / Redis）、离线 6 步脚本、证书排障、GitOps 闭环——这些地方你有完整文档，被追问就往这引。
