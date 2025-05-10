// src/pages/SignalPage.tsx
import React, { useEffect, useState } from 'react'; // 只需 useEffect 和可能的少量本地 state
import { Container, Stack, Notification, useMantineTheme } from '@mantine/core';
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

// 导入 Zustand store 和子组件
import { useWebRTCStore } from '../stores/webrtcStore'; // 路径调整
import SignalingControl from '../components/webrtc/SignalingControl';
import P2PControl from '../components/webrtc/P2PControl';
import FileTransfer from '../components/webrtc/FileTransfer';
import EventLog from '../components/webrtc/EventLog';

const SignalPage: React.FC = () => {
    const theme = useMantineTheme();

    // 从 store 获取通知状态和清理 action
    const storeNotification = useWebRTCStore(state => state.notification);
    const clearStoreNotification = useWebRTCStore(state => state.clearNotification);
    const setWorkerBaseUrl = useWebRTCStore(state => state.setWorkerBaseUrl); // 获取设置URL的action

    // 本地状态用于 Mantine Notification 的显示控制
    const [showErrorNotification, errorNotificationHandlers] = useDisclosure(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccessNotification, successNotificationHandlers] = useDisclosure(false);
    const [successMessage, setSuccessMessage] = useState('');

    // 初始化 workerBaseUrl 到 store
    useEffect(() => {
        const workerUrl = import.meta.env.VITE_WORKER_SIGNALING_URL as string;
        if (workerUrl) {
            setWorkerBaseUrl(workerUrl);
        } else {
            console.error("VITE_WORKER_SIGNALING_URL is not defined in .env");
            // 可以通过 store 显示一个全局错误，或者在UI上提示
            useWebRTCStore.getState().showNotification(
                '配置错误',
                '信令服务器URL (VITE_WORKER_SIGNALING_URL) 未在环境变量中定义!',
                'error'
            );
        }
    }, [setWorkerBaseUrl]); // 依赖 setWorkerBaseUrl (它应该是稳定的)


    // 监听 store 中的通知状态来显示 Mantine 通知
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
                successNotificationHandlers.open(); // 用 success 样式显示 info
            }
            // 清理 store 中的通知，避免重复显示
            const timer = setTimeout(() => {
                clearStoreNotification();
            }, 50); // 延迟一点确保UI渲染
            return () => clearTimeout(timer);
        }
    }, [storeNotification, successNotificationHandlers, errorNotificationHandlers, clearStoreNotification]);

    // 组件卸载时的清理
    useEffect(() => {
        return () => {
            console.log('[SignalTestPage] 组件即将卸载，执行顶层清理...');
            // 调用 store 中的清理函数
            useWebRTCStore.getState().disconnectFromSignaling('组件卸载');
            // P2P 连接通常会在 disconnectFromSignaling 内部被清理
            // useWebRTCStore.getState().closeP2PConnection('组件卸载'); // 如果需要确保，可以调用
            useWebRTCStore.getState()._revokeReceivedFileDownloadUrl();
            console.log('[SignalTestPage] 组件卸载清理完成。');
        };
    }, []); // 空依赖，只在挂载和卸载时执行


    // 从 store 获取条件渲染所需的状态
    const isSignalConnected = useWebRTCStore(state => state.isSignalConnected);
    const isP2PConnected = useWebRTCStore(state => state.isP2PConnected);
    return (
        <Container size="lg" py="xl">
            {/* Mantine Notifications */}
            {showSuccessNotification && successMessage && (
                <Notification
                    icon={<IconCheck size="1.2rem" />}
                    color="teal"
                    title="成功"
                    onClose={() => { successNotificationHandlers.close(); clearStoreNotification(); /* 再次确保清除 */ }}
                    styles={{ root: { position: 'fixed', top: theme.spacing.md, right: theme.spacing.md, zIndex: 2000, maxWidth: 350 } }}
                >
                    {successMessage}
                </Notification>
            )}
            {showErrorNotification && errorMessage && (
                <Notification
                    icon={<IconAlertTriangle size="1.2rem" />}
                    color="red"
                    title="错误"
                    onClose={() => { errorNotificationHandlers.close(); clearStoreNotification(); /* 再次确保清除 */ }}
                    styles={{ root: { position: 'fixed', top: theme.spacing.md, right: theme.spacing.md, zIndex: 2000, maxWidth: 350 } }}
                >
                    {errorMessage}
                </Notification>
            )}

            <Stack gap="xl">
                <SignalingControl />
                {isSignalConnected && <P2PControl />}
                {isP2PConnected && <FileTransfer />}
                <EventLog />
            </Stack>
        </Container>
    );
};

export default SignalPage;