// src/pages/PostDetailPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { IPost, SimpleComment } from '../types/types'; // 确保类型路径正确
import { postApiService } from '../services/PostService';
import { commentApiService } from '../services/CommentService';
import { useAuth } from '../context/AuthContext';
import CommentList from '../components/comment/CommentList';
import CommentForm from '../components/comment/CommentForm';
import PostForm, { PostFormData } from '../components/post/PostForm'; // 导入 PostForm
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
	Breadcrumbs,
	Anchor,
	Paper,
	Divider,
	useMantineTheme,
	Center,
	Box,
	ActionIcon,
	Tooltip,
	Notification,
	rem,
	Modal, // 导入 Modal
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconPencil, IconTrash, IconCheck } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks'; // 确保已导入

function PostDetailPage() {
	// --- Hooks ---
	const { slug } = useParams<{ slug: string }>();
	const navigate = useNavigate();
	const theme = useMantineTheme();
	const { token, user } = useAuth(); // 获取 user 对象

	// --- 帖子相关 State ---
	const [post, setPost] = useState<IPost | null>(null);
	const [isLoadingPost, setIsLoadingPost] = useState(true);
	const [errorPost, setErrorPost] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false); // 删除加载状态
	const [deleteError, deleteErrorHandlers] = useDisclosure(false); // 控制删除错误通知
	const [deleteErrorMessage, setDeleteErrorMessage] = useState(''); // 删除错误消息
	const [showSuccess, successHandlers] = useDisclosure(false); // 控制成功通知
	const [successMessage, setSuccessMessage] = useState(''); // 成功消息

	// --- Modal 和表单状态 ---
	const [modalOpened, modalHandlers] = useDisclosure(false); // 控制 Modal 显示/隐藏
	const [editingPost, setEditingPost] = useState<IPost | null>(null); // 驱动 Modal 中的 PostForm
	const [formError, setFormError] = useState<string | null>(null); // Modal 内表单提交的错误状态
	const [showFormError, formErrorHandlers] = useDisclosure(false); // 控制 Modal 错误通知

	// --- 评论相关 State ---
	const [comments, setComments] = useState<SimpleComment[]>([]);
	const [isCommentsLoading, setIsCommentsLoading] = useState(false);
	const [errorComments, setErrorComments] = useState<string | null>(null);
	const [isSubmittingComment, setIsSubmittingComment] = useState(false);

	// --- 获取评论的函数 ---
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

	// --- 封装获取帖子详情逻辑，以便在更新后调用 ---
	const fetchPostDetails = useCallback(async () => {
		if (!slug) {
			setErrorPost("Post identifier (slug) is missing in the URL.");
			// setIsLoadingPost(false); // Maybe not needed if just refreshing
			return;
		}
		// Consider showing a subtle loading indicator or none for refresh
		// setIsLoadingPost(true);
		setErrorPost(null);
		console.log(`>>> Re-fetching post with slug: ${slug}`);
		try {
			const response = await postApiService.getPostBySlug(slug);
			if (response.success && response.data) {
				setPost(response.data); // Update post state
			} else {
				const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(errMsg || 'Failed to reload post');
			}
		} catch (err: any) {
			console.error("Re-fetch post detail error:", err);
			const errorMessage = err instanceof Error ? err.message : 'Failed to reload post details.';
			setErrorPost(errorMessage); // Set page error state
		} finally {
			// setIsLoadingPost(false);
		}
	}, [slug]); // Dependency: slug

	// --- 获取帖子详情的 Effect (依赖 slug, fetchComments) ---
	useEffect(() => {
		const initialFetch = async () => {
			if (!slug) {
				setErrorPost("Post identifier (slug) is missing in the URL.");
				setIsLoadingPost(false);
				return;
			}
			setIsLoadingPost(true);
			setErrorPost(null);
			console.log(`>>> Initial fetching post with slug: ${slug}`);
			try {
				const response = await postApiService.getPostBySlug(slug);
				console.log(`<<< Post API Response Status: ${response.success}`);
				if (response.success && response.data) {
					setPost(response.data);
					fetchComments(response.data._id); // Fetch comments after post loads
				} else {
					const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
					throw new Error(errMsg || 'Failed to load post');
				}
			} catch (err: any) {
				console.error("Initial fetch post detail error:", err);
				const errorMessage = err instanceof Error ? err.message : 'Failed to load post details.';
				setErrorPost(errorMessage);
				setPost(null);
			} finally {
				setIsLoadingPost(false);
			}
		};
		initialFetch();
	}, [slug, fetchComments]); // Dependencies: slug, fetchComments

	// --- 处理评论提交的函数 ---
	const handleCommentSubmit = async (content: string) => {
		if (!post?._id || !token) {
			const errorMsg = "Cannot submit comment. Post not loaded or you are not logged in.";
			setErrorComments(errorMsg);
			console.error("Comment submission failed:", errorMsg);
			return;
		}
		setIsSubmittingComment(true);
		setErrorComments(null);
		console.log(`>>> Submitting comment for post: ${post._id}`);
		try {
			const response = await commentApiService.addComment(post._id, content);
			console.log(`<<< Add Comment API Response Status: ${response.success}`);
			if (response.success && response.data) {
				console.log('Comment added successfully:', response.data);
				// Re-fetch comments to show the new one
				await fetchComments(post._id);
				// Also update post's comment count locally for immediate feedback
				setPost(prevPost => prevPost ? { ...prevPost, commentCount: (prevPost.commentCount ?? 0) + 1 } : null);
			} else {
				const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(errMsg || 'Failed to submit comment');
			}
		} catch (err: any) {
			console.error("Submit comment error:", err);
			const message = err instanceof Error ? err.message : 'An error occurred while posting the comment.';
			setErrorComments(message);
		} finally {
			setIsSubmittingComment(false);
		}
	};

	// --- 实现删除评论的回调函数 ---
	const handleCommentDeleted = (deletedCommentId: string) => {
		console.log(`Callback: Deleting comment ${deletedCommentId} from state.`);
		setComments(currentComments => currentComments.filter(comment => comment._id !== deletedCommentId));
		// Update post's comment count
		setPost(prevPost => prevPost ? { ...prevPost, commentCount: Math.max(0, (prevPost.commentCount ?? 0) - 1) } : null);
		// Notification is handled within CommentList or shown via successMessage state if needed here
	};

	// --- 判断当前用户是否为帖子作者 ---
	const isCurrentUserAuthor = !!(user && post && post.authorId && user.id === post.authorId.toString());

	// --- 处理编辑帖子的函数，改为打开 Modal ---
	const handleEdit = () => {
		if (post) {
			console.log(`Opening edit modal for post: ${post.title}`);
			setEditingPost(post);    // Set data for the form
			setFormError(null);      // Clear previous form errors
			formErrorHandlers.close(); // Close form error notification
			successHandlers.close(); // Close potential success notifications
			modalHandlers.open();    // Open the modal
		}
	};

	// --- 处理删除帖子的函数 ---
	const handleDelete = async () => {
		if (!post) return;
		if (!window.confirm('确定要删除这篇帖子吗？删除后不可恢复！')) {
			return;
		}
		setIsDeleting(true);
		setDeleteErrorMessage('');
		deleteErrorHandlers.close();
		successHandlers.close(); // Clear success notifications
		formErrorHandlers.close(); // Clear form error notifications
		try {
			console.log(`>>> Deleting post with ID: ${post._id}`);
			const response = await postApiService.deletePost(post._id);
			console.log(`<<< Delete Post API Response Status: ${response.success}`);
			if (response.success) {
				setSuccessMessage('帖子已成功删除！即将返回主页...');
				successHandlers.open();
				setTimeout(() => {
					navigate('/'); // Redirect to homepage
				}, 1500); // Delay for user to see message
			} else {
				const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(errMsg || '删除帖子失败');
			}
		} catch (err: any) {
			console.error("Delete post error:", err);
			const errorMessage = err instanceof Error ? err.message : '删除帖子时发生未知错误。';
			setDeleteErrorMessage(errorMessage);
			deleteErrorHandlers.open(); // Show delete error notification
		} finally {
			setIsDeleting(false); // Finish deleting state
		}
	};

	// --- 处理 Modal 内 PostForm 提交的函数 ---
	const handleModalFormSubmit = async (data: PostFormData) => {
		if (!editingPost) return; // Defensive check

		setFormError(null);       // Clear previous form errors
		formErrorHandlers.close();
		successHandlers.close();  // Clear previous success messages

		// The button inside PostForm handles its own loading state

		try {
			console.log(`>>> Updating post via modal, ID: ${editingPost._id}`);
			const response = await postApiService.updatePost(editingPost._id, data);
			console.log(`<<< Update Post API Response Status: ${response.success}`);

			if (response.success) {
				// Success
				setSuccessMessage('帖子已成功更新！'); // Set success message (page level)
				successHandlers.open();             // Show success notification (page level)
				modalHandlers.close();              // Close the modal

				// Refresh the post data on the current page
				await fetchPostDetails(); // Call the re-fetch function

			} else {
				// API returned failure
				const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(errMsg || '更新帖子失败');
			}
		} catch (err: any) {
			// Catch update error
			console.error("Update post error (modal):", err);
			const errorMessage = err instanceof Error ? err.message : '更新帖子时发生未知错误。';
			setFormError(errorMessage); // Set error state for the modal form
			formErrorHandlers.open();   // Show error notification inside/above the modal
			// Do not close modal on failure
		}
		// finally {} // PostForm's button handles its loading state
	};

	// --- 面包屑导航数据 ---
	const breadcrumbItems = [
		{ title: '主页', href: '/' },
		{ title: post?.title || '帖子详情', href: '#' }, // Current page, no actual link
	].map((item, index, arr) => (
		item.href === '#' ? (
			// Render current page title as Text (not Anchor)
			<Text key={index} size="sm" fw={index === arr.length - 1 ? 700 : 400} c={index === arr.length - 1 ? 'dark' : 'dimmed'}>
				{item.title}
			</Text>
		) : (
			// Render previous pages as Anchor links
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
				<Center h={400}> {/* Increased height */}
					<Loader color="blue" size="lg" />
					<Text ml="md" c="dimmed">正在加载帖子...</Text>
				</Center>
			</Container>
		);
	}

	// 2. 渲染帖子加载错误状态
	if (errorPost) {
		return (
			<Container size="md" py="xl">
				<Alert icon={<IconAlertCircle size={18} />} title="加载帖子出错" color="red" radius="md" variant='light'>
					{errorPost}
				</Alert>
				<Button
					mt="lg"
					leftSection={<IconArrowLeft size={16} />}
					variant="outline"
					onClick={() => navigate('/')} // Go back to homepage
				>
					返回主页
				</Button>
			</Container>
		);
	}

	// 3. 如果帖子数据为 null (Should be covered by errorPost, defensive check)
	if (!post) {
		return (
			<Container size="md" py="xl">
				<Text ta="center" c="dimmed">无法加载帖子数据。</Text>
				<Center mt="lg">
					<Button
						leftSection={<IconArrowLeft size={16} />}
						variant="outline"
						onClick={() => navigate('/')} // Go back to homepage
					>
						返回主页
					</Button>
				</Center>
			</Container>
		);
	}

	// --- 4. 帖子加载成功，渲染主要内容 ---
	return (
		<> {/* Fragment to wrap page content and modal */}
			<Container size="lg" py="xl">
				{/* --- Page Level Notifications --- */}
				{showSuccess && successMessage && (
					<Notification
						icon={<IconCheck style={{ width: rem(20), height: rem(20) }} />}
						color="teal" title="成功" onClose={successHandlers.close} mb="md" withCloseButton>
						{successMessage}
					</Notification>
				)}
				{deleteError && deleteErrorMessage && (
					<Notification
						icon={<IconAlertCircle style={{ width: rem(20), height: rem(20) }} />}
						color="red" title="删除失败" onClose={deleteErrorHandlers.close} mb="md" withCloseButton>
						{deleteErrorMessage}
					</Notification>
				)}
				{/* Post loading error handled above */}
				{/* Comment errors handled within CommentList or CommentForm */}

				{/* Breadcrumbs */}
				<Breadcrumbs separator="›" mb="lg">{breadcrumbItems}</Breadcrumbs>

				{/* Stack for vertical layout */}
				<Stack gap="xl">

					{/* Post Content Card */}
					<Paper shadow="sm" p="xl" radius="md" withBorder>
						<Stack gap="md">
							{/* Title and Action Buttons Group */}
							<Group justify="space-between" align="flex-start" wrap="nowrap">
								{/* Post Title */}
								<Title order={1} size="h1" c="blue.8" style={{ flexGrow: 1, marginRight: theme.spacing.md, wordBreak: 'break-word' }}>
									{post.title}
								</Title>
								{/* Edit and Delete Buttons (visible to author only) */}
								{token && isCurrentUserAuthor && (
									<Group gap="xs" wrap="nowrap"> {/* Prevent buttons wrapping */}
										<Tooltip label="编辑帖子" withArrow>
											<ActionIcon
												variant="light"
												color="yellow"
												onClick={handleEdit}
												disabled={isDeleting} // Disable edit while deleting
												aria-label="Edit Post"
											>
												<IconPencil size={18} />
											</ActionIcon>
										</Tooltip>
										<Tooltip label="删除帖子" withArrow>
											<ActionIcon
												variant="light"
												color="red"
												onClick={handleDelete}
												loading={isDeleting} // Show loading state
												aria-label="Delete Post"
											>
												<IconTrash size={18} />
											</ActionIcon>
										</Tooltip>
									</Group>
								)}
							</Group>
							{/* End: Title and Action Buttons */}

							{/* Post Meta Info */}
							<Group gap="sm" wrap="wrap">
								<Text size="sm" c="dimmed">•</Text>
								{/* Published Status Badge */}
								{post.isPublished ? (
									<Badge color="green" variant="light" size="sm">已发布</Badge>
								) : (
									<Badge color="yellow" variant="light" size="sm">草稿</Badge>
								)}
								{post.isPublished && post.publishedAt && (
									<>
										<Text size="sm" c="dimmed">•</Text>
										<Text size="sm" c="dimmed">
											发布于: {new Date(post.publishedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
										</Text>
									</>
								)}
								<Text size="sm" c="dimmed">•</Text>
								<Text size="sm" c="dimmed">
									更新于: {new Date(post.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
								</Text>
								{/* You might want to add Author Name here if available */}
								{/* <Text size="sm" c="dimmed">•</Text>
                                <Text size="sm" c="dimmed">作者: {post.authorName || '未知'}</Text> */}
							</Group>

							{/* Tags */}
							{post.tags && post.tags.length > 0 && (
								<Group gap={4} mt="xs">
									{post.tags.map(tag => <Badge key={tag} color="blue" variant="outline" size="sm">{tag}</Badge>)}
								</Group>
							)}

							{/* Excerpt (If you decide to bring it back or use it) */}
							{/* {post.excerpt && (
								<Text size="md" mt="sm" c="dimmed" fs="italic">
									{post.excerpt}
								</Text>
							)} */}

							{/* Content Divider */}
							<Divider my="lg" />

							{/* Post Content */}
							{/* Use pre-wrap to preserve whitespace and newlines */}
							{/* Rendering paragraphs manually might be better for styling */}
							<Box style={{ lineHeight: 1.8, fontSize: theme.fontSizes.md }}>
								{post.content.split('\n').map((paragraph, index) => (
									// Render each line as a paragraph, handle empty lines
									<Text key={index} mb="md">
										{paragraph || <> </>} {/* Use non-breaking space for empty lines */}
									</Text>
								))}
							</Box>
						</Stack>
					</Paper>

					{/* Comments Section Card */}
					<Paper shadow="xs" p="xl" radius="md" withBorder>
						<Title order={2} size="h3" mb="lg">
							评论区 <Badge variant='light' circle size="lg">{post.commentCount ?? comments.length}</Badge>
							{/* Use post.commentCount if available and reliable, otherwise fallback to comments.length */}
						</Title>

						{/* Render Comment List */}
						<CommentList
							postId={post._id} // Pass post ID
							comments={comments}
							isLoading={isCommentsLoading}
							error={errorComments}
							onCommentDeleted={handleCommentDeleted} // Pass delete callback
						// Pass current user ID if CommentList needs it for delete authorization check
						// currentUserId={user?._id}
						/>


						{/* Divider */}
						{comments.length > 0 && <Divider my="lg" />}

						{/* Render Comment Form (only for logged-in users) */}
						{token ? (
							<CommentForm
								onSubmit={handleCommentSubmit}
								isSubmitting={isSubmittingComment}
							/>
						) : (
							<Center mt="lg">
								<Text size="sm" c="dimmed">
									<Anchor component={RouterLink} to="/login" inherit>登录</Anchor> 后才能添加评论
								</Text>
							</Center>
						)}
					</Paper>

					{/* Back Button */}
					<Button
						mt="md" // Spacing from comments section
						leftSection={<IconArrowLeft size={16} />}
						variant="subtle" // Softer style
						color="gray"
						onClick={() => navigate(-1)} // Use navigate(-1) to go back in history
						style={{ alignSelf: 'flex-start' }}
					>
						返回上一页
					</Button>
				</Stack>
			</Container>

			{/* --- Edit Post Modal --- */}
			<Modal
				opened={modalOpened}
				onClose={modalHandlers.close}
				title={<Title order={3}>编辑帖子</Title>} // Title is fixed for editing
				size="xl" // Adjust size as needed
				centered
				overlayProps={{ backgroundOpacity: 0.6, blur: 4 }}
				closeOnClickOutside={false} // Prevent closing on outside click
				transitionProps={{ transition: 'pop', duration: 300, timingFunction: 'ease' }}
				zIndex={1001} // Ensure modal is above other elements if needed
			>
				{/* Error Alert for Form Submission inside Modal */}
				{showFormError && formError && (
					<Alert
						color="red"
						title="更新失败"
						icon={<IconAlertCircle size={16} />}
						mb="lg" // Spacing below alert
						withCloseButton
						onClose={() => { setFormError(null); formErrorHandlers.close(); }} // Clear error on close
						variant="light" // Or 'filled'
					>
						{formError}
					</Alert>
				)}
				{/* Render PostForm Component */}
				{/* Ensure editingPost is not null before rendering */}
				{editingPost && (
					<PostForm
						// Key ensures form resets when different post is edited
						key={`edit-${editingPost._id}`}
						initialData={editingPost}      // Pass current post data
						onSubmit={handleModalFormSubmit} // Use the modal-specific submit handler
						onCancel={modalHandlers.close} // Close modal on form cancel
					// Pass availableTags if needed, e.g., from post or a global state/fetch
					// availableTags={post?.tags || []}
					/>
				)}
			</Modal>
		</> // End Fragment
	);
}

export default PostDetailPage;