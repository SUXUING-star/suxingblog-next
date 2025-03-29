// src/pages/HomePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
// 确保你的类型文件路径正确 (可能是 ../types 或 ../types/index 等)
import { IPost, PaginationInfo } from '../types/types';
import { postApiService } from '../services/PostApiService';
// 确保导入的是 Mantine 版本的组件，并且路径正确
import PostForm, { PostFormData } from '../components/post/PostForm';
import PostList from '../components/post/PostList';
import PostPagination from '../components/Pagination';
// 导入 Mantine UI 组件
import {
	Container,
	Title,
	Loader,
	Center,
	Stack,
	useMantineTheme,
	Notification,
	rem,
	Button,
	Modal,
	Group,
	Divider,
	Box,
	Text, // 用于列表加载失败时的提示
	Alert, // 用于 Modal 内部的错误提示 (保持之前逻辑)
} from '@mantine/core';
// 导入图标
import { IconAlertCircle, IconCheck, IconPlus } from '@tabler/icons-react';
// 导入 Mantine Hooks
import { useDisclosure } from '@mantine/hooks';
import { useAuth } from '../context/AuthContext';

function HomePage() {
	// --- 状态管理 ---
	const [posts, setPosts] = useState<IPost[]>([]);
	const [isLoading, setIsLoading] = useState(false); // 全局加载状态
	const [error, setError] = useState<string | null>(null); // 错误信息状态
	const [editingPost, setEditingPost] = useState<IPost | null>(null); // 正在编辑的帖子，也用于 Modal
	const [pagination, setPagination] = useState<PaginationInfo | null>(null); // 分页信息
	const [currentPage, setCurrentPage] = useState(1); // 当前页码
	const postsPerPage = 5; // 每页帖子数 (常量)
	const theme = useMantineTheme(); // 获取主题变量 (可选)

	// --- 控制 Modal 的开关状态 ---
	const [isEditingModal, setIsEditingModal] = useState(false); // 区分创建/编辑 Modal
	const [modalOpened, modalHandlers] = useDisclosure(false); // 控制 Modal 显示/隐藏

	// --- 控制通知 ---
	const [showError, errorHandlers] = useDisclosure(false); // 控制错误通知
	const [showSuccess, successHandlers] = useDisclosure(false); // 控制成功通知
	const [successMessage, setSuccessMessage] = useState(''); // 成功通知的消息
	const { token } = useAuth(); // 获取 token

	// --- 数据获取函数 ---
	// useCallback 确保 fetchPosts 函数引用在依赖不变时保持稳定
	const fetchPosts = useCallback(async (page: number) => {
		setIsLoading(true); // 开始加载
		setError(null);     // 清除旧错误
		errorHandlers.close(); // 关闭错误通知
		successHandlers.close();// 关闭成功通知
		console.log(`>>> fetchPosts CALLED with page: ${page}`); // 调试日志

		try {
			const response = await postApiService.getPosts({
				page: page,
				limit: postsPerPage,
				sort: 'createdAt:desc'
			});
			if (response.success && response.data) {
				setPosts(response.data);
				setPagination(response.pagination || null); // 假设 pagination 在响应中
			} else { throw new Error(/*...*/); }
		} catch (err: any) { /*...*/ }
		finally {
			// 无论成功或失败，都结束加载状态
			setIsLoading(false);
		}
		// }, [postsPerPage, ...]); // 确认依赖
	}, [postsPerPage]); // 只依赖 postsPerPage/ <-- 移除 errorHandlers 和 successHandlers 以修复循环！
	// }, [postsPerPage]); // <--- 正确的依赖数组应该只有 postsPerPage (因为 handler 调用不应影响函数定义)
	// !! 根据最新的讨论，这里仍然包含了 handlers，如果还循环，请移除它们 !!
	// !! 最保险的写法是完全移除它们: [postsPerPage]

	// --- useEffect: 组件挂载和 currentPage 更新时获取数据 ---
	useEffect(() => {
		console.log(`>>> useEffect RUNNING because fetchPosts or currentPage changed. CurrentPage: ${currentPage}`);
		fetchPosts(currentPage); // 调用数据获取函数
	}, [fetchPosts, currentPage]); // 依赖 fetchPosts 的引用和 currentPage 的值

	// --- 打开创建 Modal ---
	const openCreateModal = () => {
		setEditingPost(null);      // 清空编辑对象
		setIsEditingModal(false);  // 标记为创建模式
		setError(null);            // 清除表单可能产生的旧错误
		errorHandlers.close();   // 关闭错误通知
		modalHandlers.open();    // 打开 Modal
	};

	// --- 打开编辑 Modal ---
	const openEditModal = (post: IPost) => {
		setEditingPost(post);      // 设置编辑对象
		setIsEditingModal(true);   // 标记为编辑模式
		setError(null);            // 清除表单可能产生的旧错误
		errorHandlers.close();   // 关闭错误通知
		modalHandlers.open();    // 打开 Modal
	};

	// --- 表单提交处理 (由 Modal 内的 PostForm 触发) ---
	const handleFormSubmit = async (data: PostFormData) => {
		setError(null);          // 清除旧错误
		errorHandlers.close();   // 关闭错误通知
		successHandlers.close(); // 关闭成功通知
		// 表单内部按钮会显示 loading，这里不需要全局 setIsLoading

		try {
			// 根据 isEditingModal 判断调用哪个 API
			const response = isEditingModal && editingPost
				? await postApiService.updatePost(editingPost._id, data)
				: await postApiService.createPost(data);

			if (response.success) {
				// 成功
				setSuccessMessage(`Post ${isEditingModal ? 'updated' : 'created'} successfully!`); // 设置成功消息
				successHandlers.open(); // 显示成功通知
				modalHandlers.close();  // 关闭 Modal

				// 刷新数据
				const pageToFetch = isEditingModal ? currentPage : 1; // 更新留在当前页，创建去第一页
				// 如果是创建操作，需要将 currentPage 状态也重置为 1
				if (!isEditingModal) {
					setCurrentPage(1);
				}
				// 等待数据获取完成
				await fetchPosts(pageToFetch);
			} else {
				// API 返回失败
				const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(errMsg || 'Operation failed');
			}
		} catch (err: any) {
			// 捕获错误
			console.error("Submit error:", err);
			const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during save.';
			setError(errorMessage); // 设置错误状态
			errorHandlers.open(); // 显示错误通知
			// 失败时不关闭 Modal，让用户可以继续编辑或看到错误
		}
		// finally {} // 不需要全局 setIsLoading
	};

	// --- 删除帖子处理 ---
	const handleDelete = async (id: string) => {
		// 确认弹窗
		if (!window.confirm('Are you sure you want to delete this post?')) {
			return;
		}

		setError(null);          // 清除旧错误
		errorHandlers.close();   // 关闭错误通知
		successHandlers.close(); // 关闭成功通知

		try {
			// 调用删除 API
			const response = await postApiService.deletePost(id);

			if (response.success) {
				// 成功
				setSuccessMessage('Post deleted successfully!'); // 设置成功消息
				successHandlers.open(); // 显示成功通知

				// 决定刷新哪一页
				const isLastItemOnPage = posts.length === 1 && currentPage > 1;
				const pageToFetch = isLastItemOnPage ? currentPage - 1 : currentPage;
				// 如果需要跳转到前一页，更新 currentPage 状态
				if (isLastItemOnPage) {
					setCurrentPage(pageToFetch);
				}
				// 等待数据获取完成
				await fetchPosts(pageToFetch);
			} else {
				// API 返回失败
				const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
				throw new Error(errMsg || 'Delete failed');
			}
		} catch (err: any) {
			// 捕获错误
			console.error("Delete error:", err);
			const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during delete.';
			setError(errorMessage); // 设置错误状态
			errorHandlers.open(); // 显示错误通知
		}
	};

	// --- 分页改变处理 ---
	const handlePageChange = (newPage: number) => {
		// 只有在不在加载中且页码有效时才更新状态
		if (newPage >= 1 && (!pagination || newPage <= pagination.totalPages) && !isLoading) {
			setCurrentPage(newPage); // 更新 currentPage，useEffect 会自动获取数据
		}
	};

	// --- 渲染 JSX ---
	return (
		// 使用 React Fragment (<>...</>) 包裹页面和 Modal
		<>
			{/* 主页面容器 */}
			<Container size="lg" py="xl">
				{/* 使用 Stack 进行垂直布局 */}
				<Stack gap="xl">
					{/* Section 1: 标题和创建按钮 */}
					<Group justify="space-between" align="center">
						<Title order={1} c="blue.7">
							快速分享你心中的想法
						</Title>
						{/* --- 条件渲染创建按钮 --- */}
						{token && (
							<Button
								leftSection={<IconPlus size={18} />}
								onClick={openCreateModal}
								radius="md"
								variant="gradient"
								gradient={{ from: 'blue', to: 'cyan' }}
							>
								点我创建
							</Button>
						)}
					</Group>

					{/* Section 2: 通知区域 */}
					{/* 错误通知，条件渲染 */}
					{showError && error && (
						<Notification
							icon={<IconAlertCircle style={{ width: rem(20), height: rem(20) }} />}
							color="red"
							title="Operation Failed!"
							onClose={errorHandlers.close} // 点击关闭按钮时触发
							mb="md" // 底部 margin
							withCloseButton // 显示关闭按钮
						>
							{error}
						</Notification>
					)}
					{/* 成功通知，条件渲染 */}
					{showSuccess && successMessage && (
						<Notification
							icon={<IconCheck style={{ width: rem(20), height: rem(20) }} />}
							color="teal"
							title="Success!"
							onClose={successHandlers.close}
							mb="md"
							withCloseButton
						>
							{successMessage}
						</Notification>
					)}

					{/* Section 3: 分隔线 */}
					<Divider my="md" />

					{/* Section 4: 帖子列表区域 */}
					<Box>
						{/* 条件渲染：加载中、加载出错或显示列表 */}
						{isLoading && posts.length === 0 ? (
							// 初始加载状态
							<Center h={300} style={{ border: `1px dashed ${theme.colors.gray[3]}`, borderRadius: theme.radius.md }}>
								<Loader color="blue" type="bars" /> {/* 使用不同的 Loader 样式 */}
							</Center>
						) : error && posts.length === 0 ? (
							// 加载出错且无数据
							<Center h={200} style={{ border: `1px dashed ${theme.colors.red[3]}`, borderRadius: theme.radius.md }}>
								<Text c="red">Failed to load posts. Please check the connection or try again later.</Text>
							</Center>
						) : (
							// 正常显示列表 (或空列表提示在 PostList 内部处理)
							<PostList
								posts={posts}
								onEdit={openEditModal}
								onDelete={handleDelete}
								editingPostId={null} // 列表项本身不关心哪个 Modal 打开
							/>
						)}
					</Box>

					{/* Section 5: 分页区域 */}
					{/* 只有在非加载状态、有分页信息且总页数大于1时显示 */}
					{!isLoading && pagination && pagination.totalPages > 1 && (
						<PostPagination
							total={pagination.totalPages} // 总页数
							value={currentPage}           // 当前页
							onChange={handlePageChange}     // 切换页面回调
							position="center"             // 居中显示
						// disabled 状态由内部处理或不需要，因为父级有 isLoading 控制
						/>
					)}
				</Stack>
			</Container>

			{/* Modal 对话框：用于创建和编辑 */}
			<Modal
				opened={modalOpened}            // 控制显示/隐藏
				onClose={modalHandlers.close}   // 关闭回调
				title={                         // Modal 标题
					<Title order={3}>
						{isEditingModal ? '编辑帖子' : '创建帖子'}
					</Title>
				}
				size="xl"                       // Modal 宽度
				centered                        // 垂直居中
				overlayProps={{ backgroundOpacity: 0.6, blur: 4 }} // 背景遮罩样式
				closeOnClickOutside={false}     // 点击外部不关闭，防止误操作
				transitionProps={{ transition: 'pop', duration: 300, timingFunction: 'ease' }} // 弹出动画
			// closeOnEscape={false}        // 按 ESC 不关闭 (可选)
			// lockScroll={true}            // 打开时锁定背景滚动 (Mantine 默认)
			// withinPortal={true}          // 渲染到 Portal (Mantine 默认)
			>
				{/* Modal 内容：渲染 PostForm 组件 */}
				<PostForm
					// key 很重要，确保切换编辑对象或从创建到编辑时，表单状态能正确重置
					key={editingPost ? `edit-${editingPost._id}` : 'create'}
					initialData={editingPost}     // 传入初始数据
					onSubmit={handleFormSubmit}   // 传入提交函数
					onCancel={modalHandlers.close} // 传入取消函数 (直接关闭 Modal)
				/>
				{/* 可选：在 Modal 底部显示特定于提交的错误 */}
				{/* 这个 Alert 可能与 HomePage 顶部的 Notification 重复，根据需要选择 */}
				{showError && error && modalOpened && (
					<Alert
						color="red"
						title="Submission Error"
						icon={<IconAlertCircle size={16} />}
						mt="lg" // 与表单按钮保持间距
						withCloseButton
						onClose={errorHandlers.close}
					>
						{error}
					</Alert>
				)}
			</Modal>
		</>
	);
}

export default HomePage;