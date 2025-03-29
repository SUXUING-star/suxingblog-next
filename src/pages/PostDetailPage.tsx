// src/pages/PostDetailPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
// 确保导入类型路径正确
import { IPost, SimpleComment } from '../types/types';
import {postApiService} from '../services/PostService';
import { commentApiService } from '../services/CommentService';
// 导入 AuthContext 以检查登录状态
import { useAuth } from '../context/AuthContext';
// 导入新创建的评论组件
import CommentList from '../components/comment/CommentList';
import CommentForm from '../components/comment/CommentForm';
// 导入 Mantine 组件
import {
    Container,
    Title,
    Text,
    Badge,
    Group,
    Stack,
    Loader,
    Alert,
    Button,
    Breadcrumbs, // Mantine 面包屑
    Anchor,
    Paper,      // 用于卡片效果
    Divider,    // 分隔线
    useMantineTheme,
    Center,     // 居中
    Box,        // 通用容器
} from '@mantine/core';
// 导入图标
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';

function PostDetailPage() {
  // --- Hooks ---
  const { slug } = useParams<{ slug: string }>(); // 获取 URL 参数 :slug
  const navigate = useNavigate();                // 用于页面导航
  const theme = useMantineTheme();               // 获取 Mantine 主题 (可选)
  const { token } = useAuth();                   // 获取登录令牌，用于判断是否登录

  // --- 帖子相关 State ---
  const [post, setPost] = useState<IPost | null>(null);         // 存储帖子数据
  const [isLoadingPost, setIsLoadingPost] = useState(true);    // 帖子加载状态
  const [errorPost, setErrorPost] = useState<string | null>(null); // 帖子加载错误

  // --- 评论相关 State ---
  const [comments, setComments] = useState<SimpleComment[]>([]);    // 存储评论列表
  const [isCommentsLoading, setIsCommentsLoading] = useState(false); // 评论加载状态
  const [errorComments, setErrorComments] = useState<string | null>(null);// 评论加载/提交错误
  const [isSubmittingComment, setIsSubmittingComment] = useState(false); // 评论提交状态

  // --- 获取评论的函数 (useCallback 优化，依赖为空保证引用稳定) ---
  const fetchComments = useCallback(async (postId: string) => {
      setIsCommentsLoading(true);
      setErrorComments(null); // 清除旧的评论错误
      console.log(`>>> Fetching comments for post: ${postId}`);
      try {
          const response = await commentApiService.getComments(postId);
          console.log(`<<< Comments API Response Status: ${response.success}`);
          if (response.success && response.data) {
              setComments(response.data); // 更新评论状态
          } else {
              // 处理 API 返回失败
              const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
              throw new Error(errMsg || 'Failed to fetch comments');
          }
      } catch (err: any) {
          console.error("Fetch comments error:", err);
          const errorMessage = err instanceof Error ? err.message : 'Failed to load comments.';
          setErrorComments(errorMessage); // 设置评论错误状态
          setComments([]); // 出错时清空
      } finally {
          setIsCommentsLoading(false); // 结束评论加载状态
      }
  }, []); // 空依赖数组，fetchComments 引用稳定

  // --- 获取帖子详情的 Effect (依赖 slug) ---
  useEffect(() => {
    // 定义异步函数来获取帖子
    const fetchPost = async () => {
      // 检查 slug 是否存在
      if (!slug) {
        setErrorPost("Post identifier (slug) is missing in the URL.");
        setIsLoadingPost(false);
        return;
      }

      setIsLoadingPost(true); // 开始加载帖子
      setErrorPost(null);   // 清除旧的帖子错误
      console.log(`>>> Fetching post with slug: ${slug}`);

      try {
        // 调用 API 获取帖子
        const response = await postApiService.getPostBySlug(slug); // 使用 slug 获取
         console.log(`<<< Post API Response Status: ${response.success}`);

        if (response.success && response.data) {
          setPost(response.data); // 更新帖子状态
          // --- !! 帖子加载成功后，立即触发评论加载 !! ---
          fetchComments(response.data._id); // 使用获取到的 post._id
        } else {
          // 处理 API 返回失败
          const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
          // 根据状态码判断是 404 还是其他错误
          // if (response.status === 404) { // 假设 handleResponse 会保留 status 或需要自己处理
          //   throw new Error('Post not found');
          // } else {
            throw new Error(errMsg || 'Failed to load post');
          // }
        }
      } catch (err: any) {
        console.error("Fetch post detail error:", err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load post details.';
        setErrorPost(errorMessage); // 设置帖子错误状态
        setPost(null);           // 清空帖子数据
      } finally {
        setIsLoadingPost(false); // 结束帖子加载状态
      }
    };

    fetchPost(); // 执行获取函数
  }, [slug, fetchComments]); // 依赖 slug 和 fetchComments (fetchComments 引用是稳定的)

  // --- 处理评论提交的函数 ---
  const handleCommentSubmit = async (content: string) => {
      // 再次检查 postId 和 token，理论上此时 post 不应为 null
      if (!post?._id || !token) {
          const errorMsg = "Cannot submit comment. Post not loaded or you are not logged in.";
          setErrorComments(errorMsg); // 设置评论区错误
          console.error("Comment submission failed:", errorMsg);
          return; // 直接返回，阻止提交
          // 或者: throw new Error(errorMsg); 让 CommentForm 捕获并显示
      }

      setIsSubmittingComment(true); // 开始提交状态
      setErrorComments(null);      // 清除旧评论错误
       console.log(`>>> Submitting comment for post: ${post._id}`);

      try {
          // 调用添加评论的 API
          const response = await commentApiService.addComment(post._id, content);
           console.log(`<<< Add Comment API Response Status: ${response.success}`);

          if (response.success && response.data) {
              // 评论添加成功
              console.log('Comment added successfully:', response.data);
              // --- !! 成功后重新获取评论列表 !! ---
              // 可以直接将新评论添加到现有列表前端以获得更快反馈 (可选优化)
              // setComments(prev => [ /* 构造新评论对象 */, ...prev ]);
              // 这里选择重新获取完整列表，保证数据一致性
              await fetchComments(post._id);
          } else {
              // API 返回失败
              const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
              throw new Error(errMsg || 'Failed to submit comment');
          }
      } catch (err: any) {
          // 捕获提交错误
          console.error("Submit comment error:", err);
          const message = err instanceof Error ? err.message : 'An error occurred while posting the comment.';
          setErrorComments(message); // 设置评论错误状态，可以在 CommentForm 或页面上显示
          // 也可以选择抛出错误，让 CommentForm 处理
          // throw err;
      } finally {
           setIsSubmittingComment(false); // 结束提交状态
      }
  };


  // --- 面包屑导航数据 ---
  const breadcrumbItems = [
    { title: '主页', href: '/' },
    // 使用帖子标题，如果 post 还未加载则显示 'Post'
    { title: post?.title || 'Post Details', href: '#' }, // 当前页面不实际导航
  ].map((item, index) => (
    item.href === '#' ? (
        <Text key={index} size="sm" fw={500}>{item.title}</Text> // 当前页加粗
    ) : (
        <Anchor component={RouterLink} to={item.href} key={index} size="sm">
            {item.title}
        </Anchor>
    )
  ));


  // --- 渲染逻辑 ---

  // 1. 渲染帖子加载状态
  if (isLoadingPost) {
    return (
      <Container size="md" py="xl">
        <Center h={400}> {/* 增加高度 */}
          <Loader color="blue" size="lg" />
          <Text ml="md" c="dimmed">Loading Post...</Text>
        </Center>
      </Container>
    );
  }

  // 2. 渲染帖子加载错误状态
  if (errorPost) {
    return (
      <Container size="md" py="xl">
        <Alert icon={<IconAlertCircle size={18} />} title="Error Loading Post" color="red" radius="md" variant='light'>
          {errorPost}
        </Alert>
         <Button
            mt="lg"
            leftSection={<IconArrowLeft size={16} />}
            variant="outline"
            onClick={() => navigate('/')} // 返回首页
         >
            返回主页
          </Button>
      </Container>
    );
  }

  // 3. 如果帖子数据为 null (理论上会被 errorPost 覆盖，除非 API 成功但 data 为空)
  if (!post) {
    return (
       <Container size="md" py="xl">
           <Text ta="center" c="dimmed">Post data could not be loaded.</Text>
            <Center mt="lg">
                <Button
                    leftSection={<IconArrowLeft size={16} />}
                    variant="outline"
                    onClick={() => navigate('/')} // 返回首页
                >
                    返回主页
                </Button>
            </Center>
       </Container>
    );
  }

  // --- 4. 帖子加载成功，渲染主要内容 ---
  return (
    <Container size="lg" py="xl">
       {/* 面包屑 */}
       <Breadcrumbs separator="›" mb="lg">{breadcrumbItems}</Breadcrumbs>

      {/* 使用 Stack 垂直排列帖子内容和评论区 */}
      <Stack gap="xl">

        {/* 帖子内容卡片 */}
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack gap="md">
            {/* 帖子标题 */}
            <Title order={1} size="h1" c="blue.8">
              {post.title}
            </Title>

            {/* 帖子元信息 */}
            <Group gap="sm" wrap="wrap" /* style={{ marginTop: rem(-5), marginBottom: rem(5) }} */ >
              <Text size="sm" c="dimmed">•</Text>
              {/* 根据发布状态显示徽章或文字 */}
              {post.isPublished ? (
                  <Badge color="green" variant="light" size="sm">已发布</Badge>
              ) : (
                  <Badge color="yellow" variant="light" size="sm">草稿</Badge>
              )}
              {post.isPublished && post.publishedAt && (
                  <>
                    <Text size="sm" c="dimmed">•</Text>
                    <Text size="sm" c="dimmed">
                        {new Date(post.publishedAt).toLocaleDateString('ch', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </Text>
                  </>
              )}
               <Text size="sm" c="dimmed">•</Text>
              <Text size="sm" c="dimmed">
                更新于: {new Date(post.updatedAt).toLocaleDateString('ch', { month: 'short', day: 'numeric' })}
              </Text>
            </Group>

            {/* 标签 */}
            {post.tags && post.tags.length > 0 && (
                <Group gap={4} mt="xs">
                    {post.tags.map(tag => <Badge key={tag} color="blue" variant="outline" size="sm">{tag}</Badge>)}
                </Group>
            )}

            {/* 摘要 (如果存在) */}
             {post.excerpt && (
                 <Text size="md" mt="sm" c="dimmed" fs="italic">
                     {post.excerpt}
                 </Text>
            )}

            {/* 内容分隔线 */}
            <Divider my="lg" />

            {/* 帖子内容 */}
            {/* 使用 pre-wrap 保留换行和空格 */}
            <Box style={{ lineHeight: 1.8, fontSize: theme.fontSizes.md }}>
                 {post.content.split('\n').map((paragraph, index) => (
                    // 使用 <br> 简单处理换行，或用 Mantine TypographyStylesProvider 处理 Markdown
                    <Text key={index} mb="md">
                        {paragraph || <> </>} {/* 使用   强制渲染空行 */}
                    </Text>
                 ))}
             </Box>
          </Stack>
        </Paper>

        {/* --- 评论区域卡片 --- */}
        <Paper shadow="xs" p="xl" radius="md" withBorder>
             <Title order={2} size="h3" mb="lg">
                 评论区 <Badge variant='light' circle size="lg">{comments.length}</Badge>
             </Title>

             {/* 渲染评论列表 */}
            <CommentList
                comments={comments}
                isLoading={isCommentsLoading}
                error={errorComments}
            />

             {/* 分隔线 */}
             {comments.length > 0 && <Divider my="lg" />}

             {/* 渲染评论表单 (仅登录用户) */}
             {token ? (
                <CommentForm
                    onSubmit={handleCommentSubmit}
                    isSubmitting={isSubmittingComment}
                />
             ) : (
                <Center mt="lg">
                    <Text size="sm" c="dimmed">
                         <Anchor component={RouterLink} to="/login" inherit>登录</Anchor> 才能添加评论
                    </Text>
                </Center>
             )}
        </Paper>

        {/* 返回按钮 */}
         <Button
            mt="md" // 与评论区分开
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle" // 更柔和的返回按钮
            color="gray"
            onClick={() => navigate(-1)} // 使用 navigate(-1) 返回历史记录上一页
            style={{ alignSelf: 'flex-start' }}
          >
            返回上一页
          </Button>
      </Stack>
    </Container>
  );
}

export default PostDetailPage;