// src/components/webrtc/EventLog.tsx
import React, { useRef, useEffect } from 'react';
import { Paper, Title, Group, ActionIcon, ScrollArea, Center, Text, Badge, Code, useMantineTheme, rgba, Box, Tooltip } from '@mantine/core';
import { IconClearAll } from '@tabler/icons-react';
import { useWebRTCStore, LogEntry } from '../../stores/webrtcStore'; // 路径调整

const EventLog: React.FC = () => {
    const theme = useMantineTheme();
    const logs = useWebRTCStore(state => state.logs);
    const clearLogs = useWebRTCStore(state => state.clearLogs);
    const logScrollAreaViewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logs.length > 0) { // Scroll to top on new log
            setTimeout(() => logScrollAreaViewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100);
        }
    }, [logs]);

    return (
        <Paper shadow="xs" p="lg" radius="md" withBorder>
            <Group justify="space-between" mb="xs">
                <Title order={3}>事件日志</Title>
                <Tooltip label="清空日志" withArrow>
                    <Box component="span">
                        <ActionIcon variant="default" onClick={clearLogs} size="lg">
                            <IconClearAll />
                        </ActionIcon>
                    </Box>
                </Tooltip>
            </Group>
            <ScrollArea h={350} viewportRef={logScrollAreaViewportRef} type="always" offsetScrollbars scrollbarSize={8}>
                {logs.length === 0 && <Center h={100}><Text c="dimmed">暂无日志</Text></Center>}
                {logs.map((log: LogEntry) => ( // 确保 log 类型是 LogEntry
                    <Paper
                        key={log.id} // 使用 store 中为 log 生成的唯一 ID
                        p="xs"
                        mb="xs"
                        radius="sm"
                        withBorder
                        style={{
                            backgroundColor: log.type === '错误' ? rgba(theme.colors.red[8], 0.1) : log.type === '接收' ? rgba(theme.colors.blue[7], 0.1) : log.type === '发送' ? rgba(theme.colors.green[7], 0.1) : log.type === 'WebRTC' ? rgba(theme.colors.violet[7], 0.1) : log.type === '信令' ? rgba(theme.colors.cyan[7], 0.1) : theme.colors.gray[0],
                            borderColor: log.type === '错误' ? theme.colors.red[4] : log.type === '接收' ? theme.colors.blue[4] : log.type === '发送' ? theme.colors.green[4] : log.type === 'WebRTC' ? theme.colors.violet[4] : log.type === '信令' ? theme.colors.cyan[4] : theme.colors.gray[4]
                        }}
                    >
                        <Group justify="space-between" wrap="nowrap">
                            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>{log.time}</Text>
                            <Badge
                                size="xs"
                                variant="light"
                                color={log.type === '错误' ? 'red' : log.type === '接收' ? 'blue' : log.type === '发送' ? 'green' : log.type === 'WebRTC' ? 'violet' : log.type === '信令' ? 'cyan' : 'gray'}
                                style={{ flexShrink: 0 }}
                            >
                                {log.type}
                            </Badge>
                        </Group>
                        <Code block fz="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '4px', backgroundColor: 'transparent' }}>
                            {log.message}
                        </Code>
                    </Paper>
                ))}
            </ScrollArea>
        </Paper>
    );
};
export default EventLog;