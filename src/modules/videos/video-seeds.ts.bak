import { DataSource } from 'typeorm';
import { Video, VideoNote, VideoInteraction, VideoStatus, InteractionType } from './video.entity';
import { User } from '../users/user.entity';
import { School } from '../schools/school.entity';

export async function seedVideos(dataSource: DataSource) {
  const videoRepo = dataSource.getRepository(Video);
  const noteRepo = dataSource.getRepository(VideoNote);
  const interactionRepo = dataSource.getRepository(VideoInteraction);
  const userRepo = dataSource.getRepository(User);
  const schoolRepo = dataSource.getRepository(School);

  // 清理现有数据
  await interactionRepo.delete({});
  await noteRepo.delete({});
  await videoRepo.delete({});

  // 获取测试数据
  const schools = await schoolRepo.find();
  const coaches = await userRepo.find({ where: { role: 'coach' as any } });
  const students = await userRepo.find({ where: { role: 'student' as any } });

  if (schools.length === 0 || coaches.length === 0) {
    console.log('No schools or coaches found, skipping video seeds');
    return;
  }

  const videoTitles = [
    '基础驾驶姿势矫正',
    '直线行驶技巧讲解',
    '曲线行驶要点分析',
    '侧方停车完整教学',
    '倒车入库步骤详解',
    '坡道定点停车技巧',
    '直角转弯注意事项',
    '科目二常见错误分析',
    '科目三路考准备',
    '安全驾驶意识培养',
    '雨天驾驶技巧',
    '夜间驾驶注意事项',
    '高速公路驾驶规范',
    '城市道路驾驶技巧',
    '紧急情况处理方法'
  ];

  const descriptions = [
    '详细讲解正确的驾驶姿势，包括座椅调节、后视镜调节等关键要点',
    '通过实际操作演示直线行驶的方向盘控制技巧',
    '分析曲线行驶中的转向时机和角度控制',
    '完整演示侧方停车的操作步骤和注意事项',
    '倒车入库的完整流程和常见问题解决方案',
    '坡道定点停车的准确操作和技巧要点',
    '直角转弯的转向时机和方法讲解',
    '总结科目二考试中学员常犯的错误和改正方法',
    '科目三路考前的准备工作和心理调节',
    '培养良好的安全驾驶习惯和意识',
    '雨天路滑情况下的安全驾驶技巧',
    '夜间驾驶的灯光使用和注意事项',
    '高速公路的进入、行驶和退出规范',
    '城市复杂路况的应对技巧',
    '突发情况的应急处理方法'
  ];

  const videos: Video[] = [];

  for (let i = 0; i < videoTitles.length; i++) {
    const school = schools[i % schools.length];
    const coach = coaches.find(c => c.schoolId === school.id) || coaches[0];
    const student = students.find(s => s.schoolId === school.id);

    const video = videoRepo.create({
      title: videoTitles[i],
      description: descriptions[i],
      filePath: `/uploads/videos/video_${i + 1}.mp4`,
      thumbnailPath: `/uploads/thumbnails/thumb_${i + 1}.jpg`,
      durationSeconds: Math.floor(Math.random() * 1800) + 300, // 5-35分钟
      coachId: coach.id,
      studentId: student?.id,
      schoolId: school.id,
      status: VideoStatus.ready,
      viewCount: Math.floor(Math.random() * 500),
      isPublic: Math.random() > 0.3, // 70% 公开
      sortOrder: i + 1,
      notes: i % 3 === 0 ? `这是第${i + 1}个视频的备注信息` : undefined,
      likeCount: Math.floor(Math.random() * 50),
      recordedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 过去30天内
    });

    videos.push(video);
  }

  const savedVideos = await videoRepo.save(videos);
  console.log(`Created ${savedVideos.length} videos`);

  // 创建视频备注
  const notes: VideoNote[] = [];
  for (let i = 0; i < savedVideos.length; i++) {
    const video = savedVideos[i];
    const coach = coaches.find(c => c.id === video.coachId);
    
    if (i % 2 === 0 && coach) { // 一半的视频有备注
      const noteContents = [
        '注意方向盘的握持方式',
        '这里需要提醒学员注意观察后视镜',
        '转向时要提前减速',
        '记住要系安全带',
        '观察周围交通情况'
      ];

      for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
        const note = noteRepo.create({
          videoId: video.id,
          content: noteContents[j % noteContents.length],
          timestampSeconds: Math.floor(Math.random() * video.durationSeconds),
          authorId: coach.id,
        });
        notes.push(note);
      }
    }
  }

  if (notes.length > 0) {
    await noteRepo.save(notes);
    console.log(`Created ${notes.length} video notes`);
  }

  // 创建用户互动数据
  const interactions: VideoInteraction[] = [];
  for (const video of savedVideos) {
    // 为每个视频随机创建一些点赞和收藏
    const relevantUsers = [
      ...coaches.filter(c => c.schoolId === video.schoolId),
      ...students.filter(s => s.schoolId === video.schoolId)
    ];

    for (const user of relevantUsers) {
      if (Math.random() > 0.7) { // 30% 概率点赞
        interactions.push(interactionRepo.create({
          videoId: video.id,
          userId: user.id,
          type: InteractionType.like,
          active: true
        }));
      }

      if (Math.random() > 0.8) { // 20% 概率收藏
        interactions.push(interactionRepo.create({
          videoId: video.id,
          userId: user.id,
          type: InteractionType.favorite,
          active: true
        }));
      }

      if (Math.random() > 0.5) { // 50% 概率观看
        interactions.push(interactionRepo.create({
          videoId: video.id,
          userId: user.id,
          type: InteractionType.view,
          active: true
        }));
      }
    }
  }

  if (interactions.length > 0) {
    await interactionRepo.save(interactions);
    console.log(`Created ${interactions.length} video interactions`);
  }

  console.log('Video seeds completed successfully');
}