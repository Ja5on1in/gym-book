<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1kKpav0grTQxBUUmBS0oACL2CES3FobvB

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy [.env.example](/Users/linjiasheng/Documents/網站開發系統/gym-book/.env.example) to `.env.local` and fill in your Firebase settings.
3. Run the app:
   `npm run dev`

## Notes

- If you do not provide Firebase values, the app falls back to the demo project already wired into the code.
- The app includes a home/booking/admin flow, plus calendar, booking, inventory statistics, and schedule management.

## Production Deploy

1. Copy [.firebaserc.example](/Users/linjiasheng/Documents/網站開發系統/gym-book/.firebaserc.example) to `.firebaserc` and set your Firebase project id.
2. Copy [.env.example](/Users/linjiasheng/Documents/網站開發系統/gym-book/.env.example) to `.env.local` and fill in the production values.
3. Make sure Firestore and Hosting are enabled in Firebase.
4. Build and deploy:
   `npm run deploy`

## Firestore Rules

- The included [firestore.rules](/Users/linjiasheng/Documents/網站開發系統/gym-book/firestore.rules) is a production starting point.
- It requires users to be signed in, including anonymous sessions, so public visitors are not fully anonymous at the database layer.
