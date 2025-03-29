// src/pages/NotFoundPage.tsx
import React from 'react';
import { Container, Title, Text, Button, Stack } from '@mantine/core'; // 引入 Image 组件（可选）
import { useNavigate } from 'react-router-dom';
// 你可以找一个合适的 404 图片放到 public 目录下，或者使用在线图片 URL
// import image404 from '/images/404-illustration.svg'; // 示例：本地图片路径

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/'); // 导航到首页
  };

  return (
    <Container size="sm" style={{ paddingTop: '5rem', paddingBottom: '5rem' }}>
      <Stack align="center" gap="xl">
        {/* 可选：添加一个 404 图片 */}
        {/* <Image
          src={image404} // 或者在线 URL "https://..."
          alt="页面未找到插画"
          maw={300} // 最大宽度
          radius="md"
        /> */}

        {/* 也可以只用文本和标题 */}
         <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--mantine-color-gray-5)'}}>
             <circle cx="12" cy="12" r="10" />
             <line x1="12" y1="8" x2="12" y2="12" />
             <line x1="12" y1="16" x2="12.01" y2="16" />
             <path d="M12 17.75A5.75 5.75 0 0 1 6.25 12H8.75A3.25 3.25 0 0 0 12 15.25V17.75Z M17.75 12A5.75 5.75 0 0 0 12 6.25V8.75A3.25 3.25 0 0 1 15.25 12H17.75Z" fill="currentColor" fillOpacity="0.2"/>
             <path d="M9 15 C9 15, 10 17, 12 17 S 15 15, 15 15" strokeWidth="1.5"/>
         </svg>

        <Title order={1} ta="center" c="red.7">
          糟糕！页面飞走了... (404)
        </Title>

        <Text size="lg" ta="center" c="dimmed">
          您访问的页面似乎不存在，或者已经被移动到其他地方了。
          不如返回首页看看？
        </Text>

        <Button
          onClick={handleGoHome}
          size="md"
          variant="gradient"
          gradient={{ from: 'orange', to: 'red' }}
          radius="md"
        >
          返回首页
        </Button>
      </Stack>
    </Container>
  );
};

export default NotFoundPage;