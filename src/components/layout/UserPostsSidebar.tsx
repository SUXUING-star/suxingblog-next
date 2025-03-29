// src/components/UserPostsSidebar.tsx
import React, { useState, useEffect } from 'react';
// Mantine 组件导入
import {
    ScrollArea, NavLink, Loader, Text, Center, Title, Button, Stack, Group, Divider, Anchor, Box, Skeleton
} from '@mantine/core';
// 图标导入
import { IconHome, IconNotebook, IconAlertCircle, IconLogin, IconLogout, IconUserCircle } from '@tabler/icons-react';
// Auth Context 导入
import { useAuth } from '../../context/AuthContext';
// API Service 导入
import { postApiService } from '../../services/PostApiService';
// 类型导入 (确保路径正确)
import { IPost } from '../../types/types';
// React Router 导入
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';

// 定义 Props 接口，接收来自 Layout 的参数
interface UserPostsSidebarProps {
    isMobile?: boolean;       // 标识是否在移动端 Drawer 中渲染
    closeDrawer?: () => void; // 用于关闭移动端 Drawer 的函数
}

// FC (Functional Component) 定义，接收 Props
const UserPostsSidebar: React.FC<UserPostsSidebarProps> = ({ isMobile = false, closeDrawer }) => {
    // --- Hooks ---
    // 从 Auth Context 获取状态和方法
    const { token, user, isInitialized, logout } = useAuth();
    // 获取当前路由信息，用于高亮活动链接
    const location = useLocation();
    // 获取导航函数，用于编程式跳转
    const navigate = useNavigate();

    // --- State for user posts ---
    const [userPosts, setUserPosts] = useState<IPost[]>([]);             // 存储用户帖子列表
    const [isLoadingPosts, setIsLoadingPosts] = useState(false);         // 是否正在加载帖子
    const [fetchError, setFetchError] = useState<string | null>(null); // 加载帖子时的错误信息

    // --- useEffect: 获取用户帖子列表 ---
    // 当用户 ID、Token 或初始化状态变化时执行
    useEffect(() => {
        const fetchUserPosts = async () => {
            // 前置条件检查：必须登录且有用户 ID
            if (!user?.id || !token) {
                setUserPosts([]);       // 清空旧帖子
                setIsLoadingPosts(false); // 停止加载状态
                setFetchError(null);      // 清除错误
                console.log("Sidebar: User not logged in or no ID, skipping fetch.");
                return; // 终止执行
            }

            console.log(`Sidebar: Fetching posts for user ${user.id}`);
            setIsLoadingPosts(true); // 开始加载
            setFetchError(null);     // 清除旧错误

            try {
                // 调用 API Service 获取帖子
                const response = await postApiService.getPosts({
                    authorId: user.id, // 按当前用户 ID 过滤
                    limit: 100,       // 获取最近 100 条 (或根据需要调整)
                    sort: 'createdAt:desc' // 按创建时间倒序
                });

                // 处理 API 响应
                if (response.success && response.data) {
                    setUserPosts(response.data); // 更新帖子列表
                } else {
                    // API 返回失败
                    const errMsg = Array.isArray(response.message) ? response.message.join(', ') : response.message;
                    throw new Error(errMsg || '无法加载您的帖子'); // 抛出中文错误
                }
            } catch (err: any) {
                // 捕获网络或处理错误
                console.error("Sidebar fetch error:", err);
                const errorMessage = err instanceof Error ? err.message : '加载帖子时出错。'; // 中文错误
                setFetchError(errorMessage);
                setUserPosts([]); // 清空列表
            } finally {
                // 无论成功失败，结束加载状态
                setIsLoadingPosts(false);
            }
        };

        // 只在 AuthContext 初始化完成，并且用户已登录时执行获取操作
        if (isInitialized && token) {
             fetchUserPosts();
        } else if (isInitialized && !token) {
             // 如果初始化完成但未登录，确保帖子状态被清空
             setUserPosts([]);
             setIsLoadingPosts(false);
             setFetchError(null);
        }

    // 依赖项：用户 ID、Token 和初始化状态
    }, [user?.id, token, isInitialized]);

    // --- 处理导航链接点击事件 (移动端关闭 Drawer) ---
    const handleNavLinkClick = () => {
        // 如果是在移动端 Drawer 中，并且 closeDrawer 函数存在，则调用它
        if (isMobile && closeDrawer) {
            console.log("Sidebar: Closing drawer due to navigation.");
            closeDrawer();
        }
    }

    // --- 顶部用户信息/登录/注册区域渲染 ---
    const renderTopSection = () => {
         // AuthContext 初始化完成前显示骨架屏
        if (!isInitialized) {
            return (
                 <Box p="md" style={ !isMobile ? { borderBottom: `1px solid var(--mantine-color-gray-3)` } : {}}>
                    <Stack gap="xs">
                        <Skeleton height={12} radius="xl" width="60%" />
                        <Skeleton height={28} radius="sm" />
                    </Stack>
                 </Box>
            );
        }
        // 已登录状态
        if (token && user) {
             return (
                 <Box p="md" pb="xs" style={ !isMobile ? { borderBottom: `1px solid var(--mantine-color-gray-3)` } : {}}>
                    <Stack gap="sm"> {/* 调整间距 */}
                        {/* Logo/标题 */}
                         <Anchor component={RouterLink} to="/" underline="never" onClick={handleNavLinkClick}>
                            <Title order={4} c="blue.7">宿星的小屋</Title>
                         </Anchor>
                         {/* 欢迎信息 */}
                         <Group wrap="nowrap" gap="xs">
                             <IconUserCircle size={20} color="var(--mantine-color-dimmed)" stroke={1.5}/>
                             <Text size="xs" c="dimmed" lineClamp={1} style={{ flex: 1 }}>
                                欢迎你, <Text span fw={500} c="dark.9">{user.name || user.email}</Text>!
                             </Text>
                         </Group>
                         {/* 登出按钮 */}
                        <Button
                            variant="light"
                            color="red"
                            size="xs"
                            fullWidth
                            onClick={() => { logout(); handleNavLinkClick(); }} // 点击后关闭 Drawer
                            leftSection={<IconLogout size={16} stroke={1.5}/>}
                            mt="xs" // 增加一点上边距
                        >
                            登出
                        </Button>
                    </Stack>
                </Box>
             );
        }
        // 未登录状态
        return (
            <Box p="md" style={ !isMobile ? { borderBottom: `1px solid var(--mantine-color-gray-3)` } : {}}>
                 <Stack gap="xs">
                     <Anchor component={RouterLink} to="/" underline="never" onClick={handleNavLinkClick}>
                         <Title order={4} c="blue.7">宿星的小屋</Title>
                     </Anchor>
                     <Text size="sm" c="dimmed">登录以管理内容</Text>
                     <Button
                        component={RouterLink} to="/login"
                        onClick={handleNavLinkClick} // 点击后关闭 Drawer
                        size="xs" fullWidth variant="filled"
                     >
                         登录
                     </Button>
                     <Button
                         component={RouterLink} to="/register"
                         onClick={handleNavLinkClick} // 点击后关闭 Drawer
                         size="xs" fullWidth variant="outline"
                     >
                         注册
                     </Button>
                 </Stack>
            </Box>
        );
    };


    // --- 用户帖子列表区域渲染 ---
    const renderUserPostsSection = () => {
         // 仅在登录且初始化后显示
        if (!token || !isInitialized) return null;

        let content;
        if (isLoadingPosts) {
            content = <Center h={100}><Loader size="xs" /></Center>;
        } else if (fetchError) {
            content = <Text c="red" size="xs" ta="center" mt="xs"><IconAlertCircle size={14}/> {fetchError}</Text>;
        } else if (userPosts.length === 0) {
            content = <Text c="dimmed" size="xs" ta="center" mt="xs">您还没有创建任何帖子。</Text>;
        } else {
            content = userPosts.map((post) => (
                <NavLink
                    key={post._id}
                    label={post.title || '无标题帖子'}
                    component={RouterLink}
                    to={`/posts/${post.slug}`}
                    leftSection={<IconNotebook size="0.9rem" stroke={1.5} />}
                    active={location.pathname === `/posts/${post.slug}`}
                    onClick={handleNavLinkClick} // 点击后关闭 Drawer
                    styles={{ root: { borderRadius: 'var(--mantine-radius-sm)' }, label:{fontSize: 'var(--mantine-font-size-xs)' /* 减小字体 */} }} // 使用 xs 字体

                    p="xs" // 减小内边距
                />
            ));
        }

        return (
             <>
                 <Title order={6} c="dimmed" tt="uppercase" px="md" pt="sm" pb={0} mt="xs"> {/* 减小上间距 */}
                    我的帖子
                 </Title>
                {/* 包裹 NavLink 的容器 */}
                 <Stack gap={0} p="md" pt={0}>
                      {content}
                 </Stack>
             </>
        );
    };


    // --- 最终 Sidebar 结构 ---
    return (
        // 使用 Stack 垂直布局，高度100%填充容器, 移除 gap 让子元素控制
        <Stack h="100%" gap={0} justify="space-between">

             {/* 上部：包含顶部信息和通用导航 */}
            <Stack gap={0}>
                {renderTopSection()}
                <Divider my="sm" /> {/* 分隔线 */}
                <Box px="md">{/* 通用导航添加左右 padding */}
                   <NavLink
                        label="仪表盘 / 首页"
                        component={RouterLink}
                        to="/"
                        leftSection={<IconHome size="1rem" stroke={1.5} />}
                        active={location.pathname === '/'}
                        onClick={handleNavLinkClick} // 点击后关闭 Drawer
                        styles={{ root: { borderRadius: 'var(--mantine-radius-sm)', marginBottom: 'var(--mantine-spacing-sm)' /* 增加下间距 */} }}
                    />
                </Box>
                {/* 如果有其他通用导航项放这里 */}
            </Stack>


            {/* 中部：用户帖子列表 (可滚动) */}
             <ScrollArea style={{ flex: 1 }} /* flex=1 占据剩余空间 */ type="auto" p="0">
                {renderUserPostsSection()}
                {/* 未登录时的提示 (如果不在 top section 处理) */}
                {!token && isInitialized && (
                   <Center style={{ height: '100%', minHeight: 150 /* 保证有足够高度显示 */ }}>
                        <Stack align="center" gap="xs">
                            <IconLogin size={32} color="var(--mantine-color-gray-5)" stroke={1.5}/>
                            <Text size="sm" c="dimmed" ta="center">登录后可查看您的帖子</Text>
                             <Button size="xs" variant='subtle' onClick={() => {navigate('/login'); handleNavLinkClick();}}>前往登录</Button>
                        </Stack>
                   </Center>
                )}
            </ScrollArea>

             {/* 底部区域 (可选，可以放设置、帮助等链接) */}
            {/* <Box p="md" style={{ borderTop: `1px solid var(--mantine-color-gray-3)` }}>
                <Text size="xs" c="dimmed">底部信息区</Text>
            </Box> */}

        </Stack>
    );
};

export default UserPostsSidebar;