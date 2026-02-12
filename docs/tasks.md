# إدارة المهام (plan_tasks)

حاليًا لوحة الإدارة (v1.0) لا تحتوي CRUD كامل لمهام الخطة، وتم توفير:
- عرض المهام في صفحات السفير/الفرع
- Toggle لمهام السفير اليدوية (manual_ambassador)
- حفظ مهام الإدارة اليدوية (manual_admin) عبر تبويب "إنجازات المهام" (يتطلب Task ID)

## إضافة مهام للخطة (سفير/فرع)
أضف صفوفًا في جدول `plan_tasks` عبر Neon SQL (مرة واحدة لكل خطة/يوم):

مثال (مهام خطة السفراء ليوم 2026-03-01):
1) تأكد أن `daily_plans_ambassadors` يحتوي تاريخ الخطة
2) خذ plan_id ثم نفذ:
```sql
INSERT INTO plan_tasks(plan_type, plan_id, title, task_mode, metric, threshold)
VALUES
('ambassador', <PLAN_ID>, 'افتح 5 صناديق اليوم', 'auto', 'boxes', 5),
('ambassador', <PLAN_ID>, 'انشر رسالة اليوم في الحالة', 'manual_ambassador', 'none', NULL),
('ambassador', <PLAN_ID>, 'تمت متابعة السفير من المشرف', 'manual_admin', 'none', NULL);
```

نفس الفكرة للفروع باستخدام `daily_plans_branches` و `plan_type='branch'`.
