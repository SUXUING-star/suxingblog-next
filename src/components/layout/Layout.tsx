// src/components/Layout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, Flex, Drawer, Center, Loader } from '@mantine/core'; // 精简 imports
import { useDisclosure } from '@mantine/hooks';
import Header from './Header'; // 引入 Header
import Footer from './Footer';
import UserPostsSidebar from './UserPostsSidebar';
import { useAuth } from '../../context/AuthContext';
import classes from './Layout.module.css'; // <--- 导入 CSS Modules

const SIDEBAR_WIDTH_DESKTOP = 260;
const HEADER_HEIGHT_MOBILE = 60; // 只用于移动端

const Layout: React.FC = () => {
    const [drawerOpened, { toggle: toggleDrawer }] = useDisclosure(false); // Drawer 开关状态
    const { isInitialized } = useAuth();

    const cssVariables = {
        '--sidebar-width': `${SIDEBAR_WIDTH_DESKTOP}px`,
        '--header-height': `${HEADER_HEIGHT_MOBILE}px`, // CSS 变量现在是移动端 Header 高度
    } as React.CSSProperties;

    return (
        <Flex className={classes.layoutContainer} style={cssVariables}>

            {/* --- 左侧固定侧边栏 (仅桌面端可见) --- */}
            <Box
                component="aside"
                className={`${classes.sidebar} ${classes.desktopOnly}`} // 添加 desktopOnly 类
                // 移除 visibleFrom="sm"，交给 CSS 控制
            >
                 {isInitialized ? <UserPostsSidebar isMobile={false} /> : <Center h="100%"><Loader size="sm" /></Center>}
                 {/* 给 Sidebar 传递一个 isMobile=false 的 prop */}
            </Box>

            {/* --- 右侧主内容区 --- */}
            {/* 这个 Flex 容器始终存在，但其 marginLeft 会响应式变化 */}
            <Flex direction="column" className={classes.mainContentArea}>

                {/* --- 移动端顶部 Header --- */}
                {/* 添加 mobileOnly 类 */}
                <Box component="header" className={`${classes.header} ${classes.mobileOnly}`}>
                    {/* 把 toggleDrawer 函数传给 Header，让 Burger 能打开移动端 Drawer */}
                    <Header toggleMobile={toggleDrawer} />
                    {/* mobileOpened 可能不需要，因为 Burger 图标样式会自动变 */}
                </Box>

                {/* --- 主内容 Outlet --- */}
                 {/* 应用 main 类，它的 padding 等由 CSS 控制 */}
                <Box component="main" className={classes.main}>
                     {isInitialized ? <Outlet /> : <Center style={{height: `calc(100vh - ${HEADER_HEIGHT_MOBILE}px - 80px)` /* 移动端高度 */}}><Loader /></Center>}
                </Box>

                {/* --- Footer (桌面和移动端都显示) --- */}
                <Box component="footer" className={classes.footer}>
                    <Footer />
                </Box>
            </Flex>

            {/* --- 移动端的侧边栏 (用 Drawer 实现) --- */}
            <Drawer
                opened={drawerOpened}           // 由状态控制
                onClose={toggleDrawer}          // 关闭回调
                padding={0}                     // 移除内边距，让 Sidebar 自己控制
                size={SIDEBAR_WIDTH_DESKTOP + 20} // Drawer 宽度可以比侧边栏稍宽一点
                // hiddenFrom="sm"              // 移除这个，Drawer 是否渲染和是否可见是两回事
                // visibleFrom='xs'          // 不使用
                withCloseButton={false}          // 通常移动端 Drawer 没有关闭按钮，通过点击遮罩或 Burger 关闭
                // 添加 Portal 配置 (可选但推荐，避免 z-index 问题)
                // withinPortal
                overlayProps={{ backgroundOpacity: 0.7, blur: 4 }} // 遮罩效果
                 styles={{ body: { height: '100%', padding: 'var(--mantine-spacing-md)'} }} // 让内部可以滚动
            >
                {/* 在 Drawer 里渲染 Sidebar 内容 */}
                {/* 确保 isInitialized 再渲染 */}
                 {isInitialized && <UserPostsSidebar isMobile={true} closeDrawer={toggleDrawer} />}
                 {/* 给 Sidebar 传 isMobile=true 和 关闭 Drawer 的函数 */}

            </Drawer>

        </Flex>
    );
};

export default Layout;