// src/pages/SignalPage.tsx
import React, { useEffect, useState } from 'react';
import { Container, Stack, Notification, useMantineTheme } from '@mantine/core';
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

import { useWebRTCStore } from '../stores/webrtcStore'; // 确保路径正确
import SignalingControl from '../components/webrtc/SignalingControl';
import P2PControl from '../components/webrtc/P2PControl';
import FileTransfer from '../components/webrtc/FileTransfer';
import EventLog from '../components/webrtc/EventLog';

const SignalPage: React.FC = () => {
    const theme = useMantineTheme();

    // 从 store 获取必要的状态和 actions
    const storeNotification = useWebRTCStore(state => state.notification);
    const clearStoreNotification = useWebRTCStore(state => state.clearNotification);
    const setApiBaseUrl = useWebRTCStore(state => state.setApiBaseUrl);
    const cleanupStore = useWebRTCStore(state => state.cleanupStore);
    const isSignalSetup = useWebRTCStore(state => state.isSignalSetup);
    const isP2PConnected = useWebRTCStore(state => state.isP2PConnected);
    const showStoreNotification = useWebRTCStore(state => state.showNotification); // 用于在配置错误时显示通知

    // 本地状态用于 Mantine Notification 的显示控制
    const [showErrorNotification, errorNotificationHandlers] = useDisclosure(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccessNotification, successNotificationHandlers] = useDisclosure(false);
    const [successMessage, setSuccessMessage] = useState('');

    // 初始化 API Base URL (从 Vite 环境变量获取)
    useEffect(() => {
        const apiUrlFromEnv = import.meta.env.VITE_API_BASE_URL+"/signal" as string;

        if (apiUrlFromEnv) {
            setApiBaseUrl(apiUrlFromEnv); // 将从环境变量获取的 URL 设置到 store
            console.log(`[SignalPage] API Base URL set from VITE_API_BASE_URL to: ${apiUrlFromEnv}`);
        } else {
            const errorMsg = '关键配置错误: VITE_API_BASE_URL 环境变量未定义!';
            console.error(errorMsg);
            // 使用 store 的通知 action 来显示全局错误
            showStoreNotification('配置错误', errorMsg, 'error');
        }
        // 这个 effect 只在组件挂载时执行一次，确保 apiBaseUrl 被正确设置
    }, [setApiBaseUrl, showStoreNotification]); // 依赖应稳定


    // 监听 store 中的通知状态，用于显示 Mantine Notification
    useEffect(() => {
        if (storeNotification) {
            if (storeNotification.type === 'success') {
                setSuccessMessage(storeNotification.message);
                successNotificationHandlers.open();
            } else if (storeNotification.type === 'error') {
                setErrorMessage(storeNotification.message);
                errorNotificationHandlers.open();
            } else if (storeNotification.type === 'info') {
                setSuccessMessage(`${storeNotification.title}: ${storeNotification.message}`);
                successNotificationHandlers.open();
            }
            // 设置一个定时器，在通知显示一段时间后，从 store 中清除该通知标记
            // 这样可以避免在组件因其他原因重渲染时，旧的通知再次被错误地显示
            const timer = setTimeout(() => {
                clearStoreNotification();
            }, 3500); // 通知显示3.5秒后清除 (可调整)
            return () => clearTimeout(timer);
        }
    }, [storeNotification, successNotificationHandlers, errorNotificationHandlers, clearStoreNotification]);

    // 组件卸载时的清理工作
    useEffect(() => {
        return () => {
            console.log('[SignalPage] 组件即将卸载，执行 Store 清理...');
            cleanupStore(); // 调用 store 中定义的总清理函数
            console.log('[SignalPage] Store 清理完成。');
        };
    }, [cleanupStore]); // cleanupStore action 引用应该是稳定的


    return (
        <Container size="lg" py="xl">
            {/* Mantine Notifications 显示 */}
            {showSuccessNotification && successMessage && (
                <Notification
                    icon={<IconCheck size="1.2rem" />}
                    color="teal"
                    title={storeNotification?.title === "成功" || !storeNotification?.title ? "操作成功" : storeNotification.title } // 优先使用 store 的 title
                    onClose={() => {
                        successNotificationHandlers.close();
                        clearStoreNotification(); // 关闭时也确保清除 store 中的标记
                    }}
                    styles={{ root: { position: 'fixed', top: theme.spacing.md, right: theme.spacing.md, zIndex: 2000, maxWidth: 350 } }}
                    withCloseButton
                >
                    {successMessage}
                </Notification>
            )}
            {showErrorNotification && errorMessage && (
                <Notification
                    icon={<IconAlertTriangle size="1.2rem" />}
                    color="red"
                    title={storeNotification?.title === "错误" || !storeNotification?.title ? "发生错误" : storeNotification.title }
                    onClose={() => {
                        errorNotificationHandlers.close();
                        clearStoreNotification();
                    }}
                    styles={{ root: { position: 'fixed', top: theme.spacing.md, right: theme.spacing.md, zIndex: 2000, maxWidth: 350 } }}
                    withCloseButton
                >
                    {errorMessage}
                </Notification>
            )}

            {/* 主要内容布局 */}
            <Stack gap="xl">
                <SignalingControl />
                {isSignalSetup && <P2PControl />}
                {isSignalSetup && isP2PConnected && <FileTransfer />}
                <EventLog />
            </Stack>
        </Container>
    );
};

export default SignalPage;