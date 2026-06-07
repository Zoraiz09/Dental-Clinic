import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, glass } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';
import { Loader } from '../components/ui';
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
    { name: 'Home', component: HomeScreen, icon: 'home-outline', labelKey: 'tabs.home' },
    { name: 'Patients', component: PatientsScreen, icon: 'people-outline', labelKey: 'tabs.patients' },
    { name: 'Charting', component: ChartingHomeScreen, icon: 'clipboard-outline', labelKey: 'tabs.charting' },
    { name: 'Earnings', component: EarningsScreen, icon: 'cash-outline', labelKey: 'tabs.earnings' },
    { name: 'Settings', component: SettingsScreen, icon: 'settings-outline', labelKey: 'tabs.settings' },
  ],
  RECEPTIONIST: [
    { name: 'Home', component: HomeScreen, icon: 'home-outline', labelKey: 'tabs.home' },
    { name: 'Schedule', component: ScheduleScreen, icon: 'calendar-outline', labelKey: 'tabs.appointments' },
    { name: 'Patients', component: PatientsScreen, icon: 'people-outline', labelKey: 'tabs.patients' },
    { name: 'Billing', component: BillingScreen, icon: 'receipt-outline', labelKey: 'tabs.billing' },
    { name: 'Settings', component: SettingsScreen, icon: 'settings-outline', labelKey: 'tabs.settings' },
  ],
  ADMIN: [
    { name: 'Home', component: HomeScreen, icon: 'home-outline', labelKey: 'tabs.home' },
    { name: 'Patients', component: PatientsScreen, icon: 'people-outline', labelKey: 'tabs.patients' },
    { name: 'Inventory', component: InventoryScreen, icon: 'cube-outline', labelKey: 'tabs.inventory' },
    { name: 'Reports', component: ReportsScreen, icon: 'bar-chart-outline', labelKey: 'tabs.reports' },
    { name: 'Settings', component: SettingsScreen, icon: 'settings-outline', labelKey: 'tabs.settings' },
  ],
};

function RoleTabs({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabs = ROLE_TABS[role];
  // Lift the bar above the iPhone home indicator / Android gesture bar.
  const bottomInset = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.forest[600],
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: 'rgba(255,253,248,0.92)',
          borderTopColor: glass.border,
          height: 60 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 8,
        },
        tabBarBackground: () => (
          <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const def = tabs.find((d) => d.name === route.name);
          return <Ionicons name={def?.icon ?? 'ellipse-outline'} size={size} color={color} />;
        },
      })}
    >
      {tabs.map((d) => (
        <Tab.Screen key={d.name} name={d.name} component={d.component} options={{ tabBarLabel: t(d.labelKey) }} />
      ))}
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: 'transparent' }}><Loader /></View>;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!profile ? (
          <Stack.Screen name="SignIn" component={SignInScreen} />
        ) : (
          <>
            <Stack.Screen name="Tabs">
              {() => <RoleTabs role={profile.role} />}
            </Stack.Screen>
            <Stack.Screen name="BookAppointment" component={BookAppointmentScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Appointments" component={ScheduleScreen} />
            <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
            <Stack.Screen name="RegisterPatient" component={RegisterPatientScreen} />
            <Stack.Screen name="BillDetail" component={BillDetailScreen} />
            <Stack.Screen name="EMRCharting" component={EMRChartingScreen} />
            <Stack.Screen name="PrescriptionBuilder" component={PrescriptionBuilderScreen} />
            <Stack.Screen name="CreateStaff" component={CreateStaffScreen} />
            <Stack.Screen name="Staff" component={StaffScreen} />
            <Stack.Screen name="Expenses" component={ExpensesScreen} />
            <Stack.Screen name="Queue" component={QueueScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
