import React, { useEffect } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, glass } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { Avatar, Loader } from '../components/ui';
import { markNotificationRead } from '../api/mutations';
import { queryClient } from '../lib/queryClient';
import { qk } from '../lib/queryKeys';
import { useIsDesktop } from '../lib/responsive';
import { UserRole } from '../types/models';

import SignInScreen from '../screens/auth/SignInScreen';
import HomeScreen from '../screens/home/HomeScreen';
import PatientsScreen from '../screens/patients/PatientsScreen';
import ScheduleScreen from '../screens/schedule/ScheduleScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import BookAppointmentScreen from '../screens/appointments/BookAppointmentScreen';
import PatientDetailScreen from '../screens/patients/PatientDetailScreen';
import RegisterPatientScreen from '../screens/patients/RegisterPatientScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import BillingScreen from '../screens/billing/BillingScreen';
import BillDetailScreen from '../screens/billing/BillDetailScreen';
import ChartingHomeScreen from '../screens/charting/ChartingHomeScreen';
import EMRChartingScreen from '../screens/charting/EMRChartingScreen';
import PrescriptionBuilderScreen from '../screens/charting/PrescriptionBuilderScreen';
import EarningsScreen from '../screens/earnings/EarningsScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import CreateStaffScreen from '../screens/admin/CreateStaffScreen';
import StaffScreen from '../screens/admin/StaffScreen';
import ExpensesScreen from '../screens/admin/ExpensesScreen';
import ServicesScreen from '../screens/services/ServicesScreen';
import { makePlaceholder } from '../screens/Placeholder';

const QueueScreen = makePlaceholder('Queue', 'list-outline');

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.cream, primary: colors.forest[600] },
};

type TabDef = { name: string; component: React.ComponentType<any>; icon: keyof typeof Ionicons.glyphMap; labelKey: string };

const ROLE_TABS: Record<UserRole, TabDef[]> = {
  DOCTOR: [
    { name: 'Home',     component: HomeScreen,        icon: 'home-outline',      labelKey: 'tabs.home' },
    { name: 'Patients', component: PatientsScreen,    icon: 'people-outline',    labelKey: 'tabs.patients' },
    { name: 'Charting', component: ChartingHomeScreen,icon: 'clipboard-outline', labelKey: 'tabs.charting' },
    { name: 'Earnings', component: EarningsScreen,    icon: 'cash-outline',      labelKey: 'tabs.earnings' },
    { name: 'Settings', component: SettingsScreen,    icon: 'settings-outline',  labelKey: 'tabs.settings' },
  ],
  RECEPTIONIST: [
    { name: 'Home',     component: HomeScreen,     icon: 'home-outline',      labelKey: 'tabs.home' },
    { name: 'Schedule', component: ScheduleScreen, icon: 'calendar-outline',  labelKey: 'tabs.appointments' },
    { name: 'Patients', component: PatientsScreen, icon: 'people-outline',    labelKey: 'tabs.patients' },
    { name: 'Billing',  component: BillingScreen,  icon: 'receipt-outline',   labelKey: 'tabs.billing' },
    { name: 'Settings', component: SettingsScreen, icon: 'settings-outline',  labelKey: 'tabs.settings' },
  ],
  ADMIN: [
    { name: 'Home',      component: HomeScreen,    icon: 'home-outline',      labelKey: 'tabs.home' },
    { name: 'Patients',  component: PatientsScreen,icon: 'people-outline',    labelKey: 'tabs.patients' },
    { name: 'Inventory', component: InventoryScreen,icon: 'cube-outline',     labelKey: 'tabs.inventory' },
    { name: 'Reports',   component: ReportsScreen, icon: 'bar-chart-outline', labelKey: 'tabs.reports' },
    { name: 'Settings',  component: SettingsScreen,icon: 'settings-outline',  labelKey: 'tabs.settings' },
  ],
};

/**
 * Desktop navigation rail: brand logo top, role sections, signed-in user pinned
 * at bottom. Replaces the bottom tab bar on wide browser windows only.
 */
function DesktopSidebar({ state, descriptors, navigation }: any) {
  const { profile } = useAuth();
  return (
    <View
      style={{
        width: 216,
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderRightColor: glass.border,  // #E2E8E6 hairline (from token)
        paddingHorizontal: 12,
        paddingTop: 20,
        paddingBottom: 16,
        justifyContent: 'space-between',
      }}
    >
      <View>
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Image
            source={require('../../assets/logo-black-vertical.png')}
            resizeMode="contain"
            style={{ width: 96, height: 100 }}
            accessibilityLabel="Noor Dentofacial Clinic"
          />
        </View>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ hovered }: any) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 9,
                paddingHorizontal: 12,
                borderRadius: 10,
                marginBottom: 2,
                // teal tint on hover; forest-50 when active
                backgroundColor: focused
                  ? colors.forest[50]
                  : hovered
                  ? 'rgba(15,118,110,0.06)'
                  : 'transparent',
              })}
            >
              {options.tabBarIcon?.({ focused, color: focused ? colors.forest[600] : colors.muted, size: 18 })}
              <Text style={{ marginLeft: 10, fontSize: 13, fontWeight: '600', color: focused ? colors.forest[600] : colors.muted }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* User chip pinned at bottom → taps to Settings */}
      <Pressable
        onPress={() => navigation.navigate('Settings')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 8,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: glass.border,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Avatar name={profile?.full_name} size={30} uri={profile?.avatar_url ?? undefined} />
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{profile?.full_name}</Text>
          <Text style={{ fontSize: 10, color: colors.muted, textTransform: 'capitalize' }}>{profile?.role?.toLowerCase()}</Text>
        </View>
      </Pressable>
    </View>
  );
}

function RoleTabs({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const tabs = ROLE_TABS[role];
  const bottomInset = Math.max(insets.bottom, 8);

  const desktopOptions = {
    tabBarPosition: 'left' as const,
    sceneStyle: { width: '100%' as const, maxWidth: 1180, alignSelf: 'center' as const },
  };

  const mobileOptions = {
    tabBarStyle: {
      // Solid semi-opaque white — no BlurView needed
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderTopColor: glass.border,
      borderTopWidth: 1,
      height: 60 + bottomInset,
      paddingBottom: bottomInset,
      paddingTop: 8,
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
  };

  return (
    <Tab.Navigator
      tabBar={isDesktop ? (props) => <DesktopSidebar {...props} /> : undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.forest[600],
        tabBarInactiveTintColor: colors.muted,
        ...(isDesktop ? desktopOptions : mobileOptions),
        tabBarIcon: ({ color, size }) => {
          const def = tabs.find((d) => d.name === route.name);
          return <Ionicons name={def?.icon ?? 'ellipse-outline'} size={isDesktop ? 18 : size} color={color} />;
        },
      })}
    >
      {tabs.map((d) => (
        <Tab.Screen key={d.name} name={d.name} component={d.component} options={{ tabBarLabel: t(d.labelKey) }} />
      ))}
    </Tab.Navigator>
  );
}

const navigationRef = createNavigationContainerRef<any>();

function openFromPush(response: Notifications.NotificationResponse) {
  const data = (response.notification.request.content.data ?? {}) as Record<string, any>;
  if (!navigationRef.isReady()) return;

  if (data.notification_id) {
    markNotificationRead(String(data.notification_id))
      .then(() => queryClient.invalidateQueries({ queryKey: qk.notifications() }))
      .catch(() => {});
  }

  switch (data.type) {
    case 'CHECKED_IN':
      navigationRef.navigate('EMRCharting', { patientId: data.patient_id, appointmentId: data.appointment_id });
      break;
    case 'AWAITING_PAYMENT':
    case 'CANCELLED':
      navigationRef.navigate('Appointments');
      break;
    case 'PAYMENT_COLLECTED':
    case 'PAYMENT_PARTIAL':
      navigationRef.navigate('Tabs', { screen: 'Earnings' });
      break;
    case 'EXPENSE_ADDED':
      navigationRef.navigate('Expenses');
      break;
    case 'LOW_STOCK':
      navigationRef.navigate('Tabs', { screen: 'Inventory' });
      break;
    default:
      break;
  }
}

export default function RootNavigator() {
  const { profile, loading } = useAuth();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!profile || Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(openFromPush);
    return () => sub.remove();
  }, [profile?.id]);

  const onNavReady = () => {
    if (!profile || Platform.OS === 'web') return;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => { if (response) openFromPush(response); })
      .catch(() => {});
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: 'transparent' }}><Loader /></View>;
  }

  const desktopContent = isDesktop
    ? { contentStyle: { width: '100%' as const, maxWidth: 1180, alignSelf: 'center' as const } }
    : {};

  return (
    <NavigationContainer theme={navTheme} ref={navigationRef} onReady={onNavReady}>
      <Stack.Navigator screenOptions={{ headerShown: false, ...desktopContent }}>
        {!profile ? (
          <Stack.Screen name="SignIn" component={SignInScreen} options={isDesktop ? { contentStyle: { width: '100%', alignSelf: 'stretch' } } : undefined} />
        ) : (
          <>
            <Stack.Screen name="Tabs" options={isDesktop ? { contentStyle: { width: '100%', alignSelf: 'stretch' } } : undefined}>
              {() => <RoleTabs role={profile.role} />}
            </Stack.Screen>
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Appointments"         component={ScheduleScreen} />
            <Stack.Screen name="PatientDetail"        component={PatientDetailScreen} />
            <Stack.Screen name="RegisterPatient"      component={RegisterPatientScreen} />
            <Stack.Screen name="BillDetail"           component={BillDetailScreen} />
            <Stack.Screen name="EMRCharting"          component={EMRChartingScreen} />
            <Stack.Screen name="PrescriptionBuilder"  component={PrescriptionBuilderScreen} />
            <Stack.Screen name="CreateStaff"          component={CreateStaffScreen} />
            <Stack.Screen name="Staff"                component={StaffScreen} />
            <Stack.Screen name="Expenses"             component={ExpensesScreen} />
            <Stack.Screen name="Services"             component={ServicesScreen} />
            <Stack.Screen name="Queue"                component={QueueScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
