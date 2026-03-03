---
status: approved
reviewers: [alice]
approved_by: [alice]
---

# 深色模式支持 - 设计文档

## 概述
为 Kanban 应用添加深色模式，支持系统主题自动检测和手动切换。

## 目标
- 支持 light/dark/system 三种模式
- CSS 变量驱动，切换无闪烁
- 持久化用户偏好

## 非目标
- 不做自定义主题色
- 不做高对比度模式

## 技术方案
1. **CSS**: CSS Custom Properties + `prefers-color-scheme`
2. **切换**: `<html>` 添加 `class="dark"`
3. **持久化**: localStorage 存储偏好
4. **防闪烁**: `<head>` 内联脚本预读取偏好

---

## 评审记录
- 2026-01-25 @alice: 方案简洁，通过
