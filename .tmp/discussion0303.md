0303 Summary

-Schema Review

1.super crew kanban的数据源位置:
.supercrew/

2. .supercrew/ 目录结构:
.supercrew/
        |-feature-name
                |-meta.yaml
                |-design.md
                |-plan.md

3.meta.yaml文件：
id/featurename/description/status/priority/team/owner/target_release/tags/dev_branch

4.design.md
初步设计文档，在dev_branch持续更新，structured markdown，包括两个部分
a)structured 部分, yml fields包括status/reviewer/approved_by（这个是for design review，是否需要enable这个审查看老板们想法，会加入这个流程是因为个人体验下来前期设计很重要，需要多费心设计，和ai来会讨论，会占据coding工作的30%左右，不建议无脑接受ai的plan）
b)markdown部分，design文档

5. plan.md
structured markdown，task breakdown
a)structured 部分，total tasks/complete tasks
b)markdown部分，workitem breakdown，markdown格式，可以考虑类似societas的floating todo bar一样在看板上做visualize


-Design Review
1.kanban renderer，基于上述schema做renderer，demo version可见于user/steinsz/supercrew_schema，（需和真实github repo 做 integration test
2.ai integration，创建一个plugin，用于对每个repo setup .supercrew目录结构和对应的文件管理。暂不考虑直接用superpowers，因为过于耦合，相对我们的需求太重。mvp之后会考虑将两者结合，实现过程会借鉴superpowsers。
3.ai integration trigger。skill/hook/pre-commit等方式都会尝试，理想情况会做成全自动，slash command作为备选方案
4.user flow: user clone his own repo -> install our plugin -> start coding (.supercrew folder will be created automatically) -> prd discussion and meta.yml be created by ai -> check in it to main/dev branch -> take the task and make plan, check-in plan to dev branch -> finish coding and check in code with final documents in docs/ folder
5.user can use kanban with github oauth see the repo status (read only for now)

-Open Discussion
1.per user/per agent track, 暂时会放在p2，在schema设计过程中会保留可扩展性以便我们未来可以兼容这个需求，但是没有放在mvp阶段，为了控制复杂度
2.ado v.s. .supercrew folder，暂时考虑用.supercrew下的文件来管理workitem，主要有两个考量：a)复杂度，在mvp阶段尽量简单。b)适用范围，目录结构更灵活不绑定ado
3. .supercrew下的feature如何和branch link起来，a)优先考虑用worktree，b)次要考虑在meta.yml中配置一个branch来做关联

-Next Step
1.add market place with corresponding skills/subagents/plugings to create and maintain .supercrew folder
2.support rendered with new schema
3.integration test with claude code and real repo
