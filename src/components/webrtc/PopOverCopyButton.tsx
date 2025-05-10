// src/components/webrtc/PopOverCopyButton.tsx
import React from 'react';
import { Tooltip, ActionIcon, CopyButton, Box } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';

interface PopOverCopyButtonProps {
    value: string;
}

const PopOverCopyButton: React.FC<PopOverCopyButtonProps> = ({ value }) => (
    <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
            <Tooltip label={copied ? '已复制!' : '复制'} withArrow position="right">
                <Box component="span">
                    <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy} variant="subtle" size="sm">
                        {copied ? <IconCheck size="0.9rem" /> : <IconCopy size="0.9rem" />}
                    </ActionIcon>
                </Box>
            </Tooltip>
        )}
    </CopyButton>
);
export default PopOverCopyButton;