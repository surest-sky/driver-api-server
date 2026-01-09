## 项目介绍

用于给 APP 编写 Api

使用 nestjs 编写

使用 Docker 可连接，mysql81 容器

数据库
host: 127.0.0.1
port: 33069
账号: root
密码：12345
database driver_app

---

## 时间占用检查机制

### 概述

预约系统通过 `_ensureNoConflict()` 方法检查时间是否被占用，确保教练在同一时间段不会有重叠的预约。

### 检查规则

1. **状态过滤**：只检查 `pending` 和 `confirmed` 状态的预约
2. **时间重叠判断**：使用 `a.startTime < endTime AND a.endTime > startTime`
3. **教练维度检查**：确保同一教练不会有冲突
4. **更新时排除**：使用 `ignoreId` 参数排除当前预约自身

### 相关接口

- **PATCH /appointments/:id/reschedule** - 重新安排预约时间
  - 自动调用 `_ensureNoConflict()` 检查冲突
  - 冲突时返回 400 错误并说明占用时间段

- **GET /appointments/slots/day?coachId=xxx&date=xxx** - 查询某日可用时间段
  - 返回每个 30 分钟时间段的可用状态
  - 状态包括：可用、已被预约、个人不可用、时间已过

### 时间验证规则

- 不能预约过去的时间
- 最多提前 30 天预约
- 课程时长至少 30 分钟
- 单次课程时长不能超过 3 小时

### 数据库表

- **appointments** - 预约表
- **availability** - 个人可用性设置表

### 后端代码位置

- **服务**: `src/modules/appointments/appointments.service.ts`
- **控制器**: `src/modules/appointments/appointments.controller.ts`
