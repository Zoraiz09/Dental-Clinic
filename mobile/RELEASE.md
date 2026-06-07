# Release & Distribution — Noor Dentofacial App

This app is **staff-only** and distributed **internally** (not on the public
App Store / Play Store consumer listings). Builds are produced with **EAS Build**.

## 0. Prerequisites
- An [Expo account](https://expo.dev) (free) → `npx expo login`
- EAS CLI → `npm i -g eas-cli` then `eas login`
- A **Supabase project** (see [`../supabase/README.md`](../supabase/README.md))
- For iOS distribution: an **Apple Developer** account ($99/yr)
- For Android distribution: a **Google Play** developer account ($25 once) — only needed for Play internal testing; APKs can also be sideloaded/MDM-pushed.

## 1. Point the build at your Supabase project
Builds read Supabase creds from env. Put them in `eas.json` (per profile) or set
EAS secrets:
```bash
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value eyJhbGci...
```
> With these unset the app falls back to **mock mode** — fine for a UI demo build, but not for real clinic use.

## 2. First-time native setup
```bash
cd mobile
eas build:configure        # links the project, creates the EAS project id
```
For **push notifications**, after the project is linked, add the EAS `projectId`
to `getExpoPushTokenAsync` (or rely on EAS injecting it) and configure FCM
(Android) + APNs (iOS) credentials via `eas credentials`.

## 3. Build

| Goal | Command | Output |
|------|---------|--------|
| Quick internal test (Android APK) | `eas build -p android --profile preview` | installable `.apk` link |
| Internal test (iOS, ad-hoc/TestFlight) | `eas build -p ios --profile preview` | `.ipa` for TestFlight |
| Dev client (for live debugging) | `eas build -p android --profile development` | dev client |
| Production | `eas build -p android --profile production` / `-p ios` | store-ready binary |

## 4. Distribute internally (choose what fits the clinic)
- **TestFlight (iOS):** `eas submit -p ios --profile production`, then invite staff emails in App Store Connect → TestFlight.
- **Play internal testing (Android):** `eas submit -p android`, add staff to the internal testers list.
- **Direct APK / MDM:** share the `preview` APK link, or push via an MDM (Intune, Jamf, etc.) for managed clinic devices.

## 5. App identity (already configured)
- Name: **Noor Dentofacial** · slug `noor-dentofacial` · scheme `noorclinic`
- Bundle id / package: `clinic.noor.dentofacial`
- Splash: forest-green (`#1B4332`) · icons in [`assets/`](assets)
- Permissions declared: Camera, Photo Library, Face ID, Notifications, Biometric

> Replace the placeholder art in `assets/` (`icon.png`, `splash-icon.png`,
> `android-icon-*`) with the official NDC logo before a production release.

## 6. Over-the-air updates (optional)
To push JS-only fixes without a full rebuild, add EAS Update:
```bash
npx expo install expo-updates
eas update:configure
eas update --branch production -m "fix: ..."
```
