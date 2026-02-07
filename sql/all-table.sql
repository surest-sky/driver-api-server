create table driver_app.availability
(
    id             bigint auto_increment comment '主键'
        primary key,
    user_id        bigint                                            not null comment '用户ID',
    start_time     datetime                                          not null comment '开始时间',
    end_time       datetime                                          not null comment '结束时间',
    `repeat`       enum ('always', 'once') default 'always'          not null comment '重复频率',
    is_unavailable tinyint(1)              default 1                 not null comment '是否不可用',
    created_at     datetime                default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at     datetime                default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间'
)
    comment '个人不可用时间' charset = utf8mb4;

create index idx_availability_time
    on driver_app.availability (start_time, end_time);

create index idx_availability_user
    on driver_app.availability (user_id);

create table driver_app.schools
(
    id                  bigint auto_increment comment '驾校唯一标识符'
        primary key,
    code                varchar(64)                        not null comment '驾校代码，用于识别不同驾校',
    name                varchar(191)                       not null comment '驾校名称',
    logo_url            varchar(255)                       null comment '驾校logo图片链接',
    driving_school_code varchar(255)                       null comment '学校唯一码',
    banner_url          varchar(255)                       null comment '驾校横幅图片链接',
    created_at          datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at          datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint code
        unique (code)
)
    comment '驾校信息表' charset = utf8mb4;

create table driver_app.users
(
    id                  bigint auto_increment comment '用户唯一标识符'
        primary key,
    email               varchar(191)                                        not null comment '用户邮箱，作为登录凭证',
    password_hash       varchar(255)                                        null comment '密码哈希值，首次登录时为空',
    name                varchar(191)              default ''                not null comment '用户姓名',
    phone               varchar(32)                                         null,
    avatar_url          varchar(255)                                        null comment '头像图片链接',
    birth_date          date                                                null comment '出生日期',
    role                enum ('student', 'coach') default 'student'         not null comment '用户角色：学员或教练',
    is_manager          tinyint(1)                default 0                 not null,
    school_id           bigint                                              null comment '所属驾校ID，外键关联schools表',
    pending_school_code varchar(255)                                        null,
    created_at          datetime                  default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at          datetime                  default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint email
        unique (email),
    constraint users_ibfk_1
        foreign key (school_id) references driver_app.schools (id)
            on update cascade on delete set null
)
    comment '用户信息表' charset = utf8mb4;

create table driver_app.appointments
(
    id            bigint auto_increment comment '预约唯一标识符'
        primary key,
    student_id    bigint                                                                                                   not null comment '学员ID，外键关联users表',
    coach_id      bigint                                                                                                   not null comment '教练ID，外键关联users表',
    start_time    datetime                                                                                                 not null comment '预约开始时间',
    end_time      datetime                                                                                                 not null comment '预约结束时间',
    status        enum ('pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show') default 'pending'         not null comment '预约状态：待确认/已确认/已拒绝/已取消/已完成/缺席',
    type          enum ('regular', 'trial', 'exam', 'makeup')                                    default 'regular'         not null comment '预约类型：常规训练/试学课程/考试/补课',
    location      varchar(191)                                                                                             null comment '训练地点',
    notes         text                                                                                                     null comment '预约备注信息',
    coach_notes   text                                                                                                     null comment '教练备注',
    student_notes text                                                                                                     null comment '学员备注',
    created_at    datetime                                                                       default CURRENT_TIMESTAMP not null comment '预约创建时间',
    updated_at    datetime                                                                       default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '预约更新时间',
    constraint appointments_ibfk_1
        foreign key (student_id) references driver_app.users (id)
            on update cascade on delete cascade,
    constraint appointments_ibfk_2
        foreign key (coach_id) references driver_app.users (id)
            on update cascade on delete cascade
)
    comment '训练预约表' charset = utf8mb4;

create table driver_app.appointment_comments
(
    id             bigint auto_increment comment '评论ID'
        primary key,
    appointment_id bigint                             not null comment '约课ID',
    user_id        bigint                             not null comment '用户ID',
    user_name      varchar(191)                       not null comment '用户名',
    role           varchar(32)                        not null comment '角色：student/coach',
    content        text                               not null comment '评论内容',
    created_at     datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    constraint fk_comment_appointment
        foreign key (appointment_id) references driver_app.appointments (id)
            on update cascade on delete cascade
)
    comment '约课评论表' charset = utf8mb4;

create index idx_comment_appointment
    on driver_app.appointment_comments (appointment_id);

create index idx_comment_user
    on driver_app.appointment_comments (user_id);

create index idx_appointments_coach_id
    on driver_app.appointments (coach_id);

create index idx_appointments_end_time
    on driver_app.appointments (end_time);

create index idx_appointments_start_time
    on driver_app.appointments (start_time);

create index idx_appointments_status
    on driver_app.appointments (status);

create index idx_appointments_student_id
    on driver_app.appointments (student_id);

create index idx_appointments_time_range
    on driver_app.appointments (start_time, end_time);

create table driver_app.conversations
(
    id                bigint auto_increment comment '对话唯一标识符'
        primary key,
    participant1_id   bigint                             not null comment '参与者1的ID，外键关联users表',
    participant1_name varchar(191)                       not null comment '参与者1姓名',
    participant2_id   bigint                             not null comment '参与者2的ID，外键关联users表',
    participant2_name varchar(191)                       not null comment '参与者2姓名',
    last_message_at   datetime                           null comment '最后一条消息时间',
    created_at        datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at        datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint conversations_ibfk_1
        foreign key (participant1_id) references driver_app.users (id)
            on update cascade on delete cascade,
    constraint conversations_ibfk_2
        foreign key (participant2_id) references driver_app.users (id)
            on update cascade on delete cascade
)
    comment '对话会话表' charset = utf8mb4;

create index idx_conversations_last_message
    on driver_app.conversations (last_message_at);

create index idx_conversations_participant1
    on driver_app.conversations (participant1_id);

create index idx_conversations_participant2
    on driver_app.conversations (participant2_id);

create table driver_app.invites
(
    id            bigint auto_increment comment '邀请码唯一标识符'
        primary key,
    code          varchar(64)                                                       not null comment '邀请码',
    inviter_id    bigint                                                            null comment '邀请人ID，外键关联users表',
    invitee_email varchar(191)                                                      not null comment '被邀请人邮箱',
    school_id     bigint                                                            not null comment '所属驾校ID，外键关联schools表',
    role          enum ('student', 'coach')               default 'student'         not null comment '邀请角色：学员或教练',
    status        enum ('pending', 'accepted', 'expired') default 'pending'         not null comment '邀请状态：待接受/已接受/已过期',
    expires_at    datetime                                                          not null comment '过期时间',
    used_at       datetime                                                          null comment '使用时间',
    created_at    datetime                                default CURRENT_TIMESTAMP not null comment '创建时间',
    constraint code
        unique (code),
    constraint invites_ibfk_1
        foreign key (inviter_id) references driver_app.users (id)
            on update cascade on delete set null,
    constraint invites_ibfk_2
        foreign key (school_id) references driver_app.schools (id)
            on update cascade on delete cascade
)
    comment '邀请码表' charset = utf8mb4;

create index idx_invites_code
    on driver_app.invites (code);

create index idx_invites_expires_at
    on driver_app.invites (expires_at);

create index idx_invites_inviter_id
    on driver_app.invites (inviter_id);

create index idx_invites_school_id
    on driver_app.invites (school_id);

create index idx_invites_status
    on driver_app.invites (status);

create table driver_app.messages
(
    id              bigint auto_increment comment '消息唯一标识符'
        primary key,
    conversation_id bigint                                                             not null comment '所属对话ID，外键关联conversations表',
    sender_id       bigint                                                             not null comment '发送者ID，外键关联users表',
    sender_name     varchar(191)                                                       not null comment '发送者姓名',
    receiver_id     bigint                                                             not null comment '接收者ID，外键关联users表',
    receiver_name   varchar(191)                                                       not null comment '接收者姓名',
    content         text                                                               not null comment '消息内容',
    message_type    enum ('text', 'image', 'file', 'system', 'course') default 'text'            not null comment '消息类型：文本/图片/文件/系统消息/课程',
    read_at         datetime                                                           null comment '阅读时间',
    created_at      datetime                                 default CURRENT_TIMESTAMP not null comment '创建时间',
    constraint messages_ibfk_1
        foreign key (conversation_id) references driver_app.conversations (id)
            on update cascade on delete cascade,
    constraint messages_ibfk_2
        foreign key (sender_id) references driver_app.users (id)
            on update cascade on delete cascade,
    constraint messages_ibfk_3
        foreign key (receiver_id) references driver_app.users (id)
            on update cascade on delete cascade
)
    comment '消息表' charset = utf8mb4;

create index idx_messages_conversation_id
    on driver_app.messages (conversation_id);

create index idx_messages_created_at
    on driver_app.messages (created_at);

create index idx_messages_read_at
    on driver_app.messages (read_at);

create index idx_messages_receiver_id
    on driver_app.messages (receiver_id);

create index idx_messages_sender_id
    on driver_app.messages (sender_id);

create table driver_app.notifications
(
    id         bigint auto_increment comment '通知唯一标识符'
        primary key,
    user_id    bigint                                                              not null comment '接收通知的用户ID，外键关联users表',
    title      varchar(191)                                                        not null comment '通知标题',
    content    text                                                                not null comment '通知内容',
    type       enum ('appointment', 'system', 'message') default 'system'          not null comment '通知类型：预约/系统/消息',
    read_at    datetime                                                            null comment '阅读时间',
    created_at datetime                                  default CURRENT_TIMESTAMP not null comment '创建时间',
    constraint notifications_ibfk_1
        foreign key (user_id) references driver_app.users (id)
            on update cascade on delete cascade
)
    comment '通知消息表' charset = utf8mb4;

create index idx_notifications_created_at
    on driver_app.notifications (created_at);

create index idx_notifications_read_at
    on driver_app.notifications (read_at);

create index idx_notifications_type
    on driver_app.notifications (type);

create index idx_notifications_user_id
    on driver_app.notifications (user_id);

create table driver_app.policies
(
    id             bigint auto_increment comment '规章制度唯一标识符'
        primary key,
    school_id      bigint                                                             not null comment '所属驾校ID，外键关联schools表',
    title          varchar(191)                                                       not null comment '规章标题',
    content        text                                                               not null comment '规章内容',
    type           enum ('rule', 'notice', 'announcement')  default 'rule'            not null comment '类型：规则/通知/公告',
    priority       enum ('low', 'normal', 'high', 'urgent') default 'normal'          not null comment '优先级：低/普通/高/紧急',
    is_active      tinyint(1)                               default 1                 not null comment '是否有效',
    effective_date date                                                               null comment '生效日期',
    created_by     bigint                                                             null comment '创建者ID，外键关联users表',
    created_at     datetime                                 default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at     datetime                                 default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint policies_ibfk_1
        foreign key (school_id) references driver_app.schools (id)
            on update cascade on delete cascade,
    constraint policies_ibfk_2
        foreign key (created_by) references driver_app.users (id)
            on update cascade on delete set null
)
    comment '驾校规章制度表' charset = utf8mb4;

create index created_by
    on driver_app.policies (created_by);

create index idx_policies_effective_date
    on driver_app.policies (effective_date);

create index idx_policies_is_active
    on driver_app.policies (is_active);

create index idx_policies_priority
    on driver_app.policies (priority);

create index idx_policies_school_id
    on driver_app.policies (school_id);

create index idx_policies_type
    on driver_app.policies (type);

create table driver_app.student_coach_relations
(
    id          bigint auto_increment comment '关联关系唯一标识符'
        primary key,
    student_id  bigint                                                not null comment '学员ID，外键关联users表',
    coach_id    bigint                                                not null comment '教练ID，外键关联users表',
    assigned_at datetime                    default CURRENT_TIMESTAMP not null comment '分配时间',
    status      enum ('active', 'inactive') default 'active'          not null comment '关系状态：激活/停用',
    notes       text                                                  null comment '备注信息',
    created_at  datetime                    default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at  datetime                    default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint unique_student_coach
        unique (student_id, coach_id),
    constraint student_coach_relations_ibfk_1
        foreign key (student_id) references driver_app.users (id)
            on update cascade on delete cascade,
    constraint student_coach_relations_ibfk_2
        foreign key (coach_id) references driver_app.users (id)
            on update cascade on delete cascade
)
    comment '学生-教练关联关系表' charset = utf8mb4;

create index idx_student_coach_coach_id
    on driver_app.student_coach_relations (coach_id);

create index idx_student_coach_status
    on driver_app.student_coach_relations (status);

create index idx_student_coach_student_id
    on driver_app.student_coach_relations (student_id);

create index idx_users_email
    on driver_app.users (email);

create index idx_users_role
    on driver_app.users (role);

create index idx_users_school_id
    on driver_app.users (school_id);

create table driver_app.videos
(
    id            bigint auto_increment comment '视频唯一标识符'
        primary key,
    school_id     bigint                                                   not null comment '所属驾校ID，外键关联 driver_app.schools 表',
    title         varchar(191)                                             not null comment '视频标题',
    description   text                                                     null comment '视频描述',
    video_url     varchar(500)                                             not null comment '视频播放地址',
    thumbnail_url varchar(500)                                             null comment '视频缩略图地址',
    duration      int                            default 0                 not null comment '视频时长（秒）',
    type          enum ('teaching', 'recording') default 'teaching'        not null comment '视频类型：teaching=教学视频，recording=拍摄记录',
    category      varchar(100)                                             null comment '视频分类',
    tags          varchar(500)                                             null comment '视频标签，多个标签以逗号分隔',
    view_count    int                            default 0                 not null comment '观看次数',
    like_count    int                            default 0                 not null comment '点赞次数',
    uploaded_by   bigint                                                   not null comment '上传者ID，外键关联 driver_app.users 表',
    student_id    bigint                                                   null comment '关联学员ID（仅适用于拍摄记录类型）',
    coach_id      bigint                                                   null comment '关联教练ID（仅适用于拍摄记录类型）',
    is_published  tinyint(1)                     default 1                 not null comment '是否已发布（1=是，0=否）',
    created_at    datetime                       default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at    datetime                       default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint videos_ibfk_1
        foreign key (school_id) references driver_app.schools (id)
            on update cascade on delete cascade,
    constraint videos_ibfk_2
        foreign key (uploaded_by) references driver_app.users (id)
            on update cascade on delete cascade,
    constraint videos_ibfk_3
        foreign key (student_id) references driver_app.users (id)
            on update cascade on delete set null,
    constraint videos_ibfk_4
        foreign key (coach_id) references driver_app.users (id)
            on update cascade on delete set null
)
    comment '视频表，用于存储教学视频与学员拍摄记录等信息' charset = utf8mb4;

create table driver_app.learning_records
(
    id                  bigint auto_increment comment '学习记录唯一标识符'
        primary key,
    user_id             bigint                                  not null comment '学员ID，外键关联 driver_app.users 表',
    video_id            bigint                                  not null comment '视频ID，外键关联 driver_app.videos 表',
    watch_duration      int           default 0                 not null comment '观看时长（秒）',
    progress            decimal(5, 2) default 0.00              not null comment '观看进度（百分比，0-100）',
    last_watch_position int           default 0                 not null comment '最后观看位置（秒）',
    is_completed        tinyint(1)    default 0                 not null comment '是否完成观看（0=未完成，1=已完成）',
    first_watched_at    datetime      default CURRENT_TIMESTAMP not null comment '首次观看时间',
    last_watched_at     datetime      default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '最后观看时间',
    constraint unique_user_video
        unique (user_id, video_id),
    constraint learning_records_ibfk_1
        foreign key (user_id) references driver_app.users (id)
            on update cascade on delete cascade,
    constraint learning_records_ibfk_2
        foreign key (video_id) references driver_app.videos (id)
            on update cascade on delete cascade
)
    comment '学习记录表：用于记录学员观看教学视频的进度、时长等信息' charset = utf8mb4;

create index idx_learning_records_completed
    on driver_app.learning_records (is_completed);

create index idx_learning_records_last_watched
    on driver_app.learning_records (last_watched_at);

create index idx_learning_records_progress
    on driver_app.learning_records (progress);

create index idx_learning_records_user_id
    on driver_app.learning_records (user_id);

create index idx_learning_records_video_id
    on driver_app.learning_records (video_id);

create table driver_app.video_comments
(
    id         bigint auto_increment comment '评论唯一标识符'
        primary key,
    video_id   bigint                             not null comment '视频ID，外键关联 driver_app.videos 表',
    user_id    bigint                             not null comment '评论用户ID，外键关联 driver_app.users 表',
    user_name  varchar(191)                       not null comment '评论用户姓名',
    user_role  varchar(32)                        not null comment '用户角色：student=学员，coach=教练',
    content    text                               not null comment '评论内容',
    parent_id  bigint                             null comment '父评论ID（用于回复功能）',
    created_at datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    constraint video_comments_ibfk_1
        foreign key (video_id) references driver_app.videos (id)
            on update cascade on delete cascade,
    constraint video_comments_ibfk_2
        foreign key (user_id) references driver_app.users (id)
            on update cascade on delete cascade,
    constraint video_comments_ibfk_3
        foreign key (parent_id) references driver_app.video_comments (id)
            on update cascade on delete cascade
)
    comment '视频评论表，用于存储用户对视频的评论与回复' charset = utf8mb4;

create index idx_video_comments_created_at
    on driver_app.video_comments (created_at);

create index idx_video_comments_parent_id
    on driver_app.video_comments (parent_id);

create index idx_video_comments_user_id
    on driver_app.video_comments (user_id);

create index idx_video_comments_video_id
    on driver_app.video_comments (video_id);

create index idx_videos_coach_id
    on driver_app.videos (coach_id);

create index idx_videos_created_at
    on driver_app.videos (created_at);

create index idx_videos_is_published
    on driver_app.videos (is_published);

create index idx_videos_school_id
    on driver_app.videos (school_id);

create index idx_videos_student_id
    on driver_app.videos (student_id);

create index idx_videos_type
    on driver_app.videos (type);

create index idx_videos_uploaded_by
    on driver_app.videos (uploaded_by);

create table driver_app.video_favorites
(
    id         bigint auto_increment comment '收藏记录ID'
        primary key,
    video_id   bigint                                        not null comment '视频ID',
    user_id    bigint                                        not null comment '用户ID',
    created_at datetime default CURRENT_TIMESTAMP            not null comment '收藏时间',
    constraint uq_video_favorites_user_video
        unique (user_id, video_id),
    constraint video_favorites_ibfk_1
        foreign key (video_id) references driver_app.videos (id)
            on update cascade on delete cascade,
    constraint video_favorites_ibfk_2
        foreign key (user_id) references driver_app.users (id)
            on update cascade on delete cascade
)
    comment '视频收藏表' charset = utf8mb4;

create index idx_video_favorites_created_at
    on driver_app.video_favorites (created_at);

create index idx_video_favorites_video_id
    on driver_app.video_favorites (video_id);

create table driver_app.app_updates
(
    id             bigint auto_increment comment '版本记录ID'
        primary key,
    platform       enum ('ios', 'android')                  not null comment '平台',
    version        varchar(32)                              not null comment '版本号，如 1.0.0',
    build_number   int            default 1                 not null comment '构建号',
    version_code   int            default 1                 not null comment '版本码',
    download_url   varchar(512)                             null comment '安卓 APK 下载地址',
    play_store_url varchar(512)                             null comment 'Google Play 地址',
    app_store_url  varchar(512)                             null comment 'App Store 地址',
    release_notes  text                                     null comment '更新说明',
    force_update   tinyint(1)    default 0                 not null comment '是否强制更新',
    is_active      tinyint(1)    default 1                 not null comment '是否参与更新检测',
    created_at     datetime       default CURRENT_TIMESTAMP not null comment '创建时间',
    updated_at     datetime       default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间'
)
    comment 'App 版本更新表' charset = utf8mb4;

create index idx_app_updates_platform_active_code
    on driver_app.app_updates (platform, is_active, version_code);
