// src/components/Header.tsx
import React from 'react';
import { Container, Group, Burger, Box, Title, Anchor } from '@mantine/core'; // 确保导入 Burger, Box, Title, Anchor
import { Link as RouterLink } from 'react-router-dom';

// Props 只需要 toggle 函数
interface HeaderProps {
    toggleMobile: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleMobile }) => {
  return (
    // 用 Box 并设置 h="100%" 确保占满 Layout 传来的高度
    <Box h="100%" px="md">
        {/* Group 垂直居中 Burger */}
        <Group h="100%" align="center" justify='space-between'/* 左对齐 Burger */ >
             {/* Burger */}
             <Burger
                // opened 状态现在由 Drawer 控制，Burger 只是触发器
                // opened={false}
                onClick={toggleMobile} // 点击时调用 toggle 函数
                size="sm"
                aria-label="打开导航" // 添加 aria-label
             />
             {/* 可以在这里放移动端 Logo 或标题 (可选) */}
              <Anchor component={RouterLink} to="/" underline="never" >
                 <Title order={4} c="blue.7">宿星的小屋</Title>
              </Anchor>
               {/* 右侧可以留空或放其他移动端特有图标 */}
                <Box w={28}></Box> {/* 占位使标题居中 */}
        </Group>
    </Box>
  );
};

export default Header;