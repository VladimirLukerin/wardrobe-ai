import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { AppTabBar } from '@/components/app-tab-bar';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <AppTabBar />
      <TabList style={styles.hiddenTabList}>
        <TabTrigger name="home" href="/" />
        <TabTrigger name="garderob" href="/garderob" />
        <TabTrigger name="create-outfit" href="/create-outfit" />
        <TabTrigger name="profile" href="/profile" />
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
  },
  hiddenTabList: {
    display: 'none',
  },
});
