// src/components/Footer.tsx
import React from 'react';
import { Box, Text, Center, Anchor } from '@mantine/core';

const Footer: React.FC = () => {
  return (
    <Box component="footer" py="lg" mt="xl" bg="gray.1">
      <Center>
        <Text size="sm" c="gray.6">
          © {new Date().getFullYear()} 宿星的小屋 ❤️ by [suxing-star].
          <Anchor href="https://github.com/" target="_blank" size="sm" ml="xs">
            GitHub
          </Anchor>
        </Text>
      </Center>
    </Box>
  );
};

export default Footer;