# SorSU Document Request System

A secure, modern document request system for Sorsogon State University (SorSU) that allows students to request academic documents online and enables registrars to manage requests efficiently.

## Features

### For Students
- **Online Document Requests**: Submit requests for Transcript of Records, Diploma, Certificate of Good Moral, and Authentication/CAV
- **Real-time Status Tracking**: Monitor request status from submission to completion with instant updates
- **Live Status Updates**: See status changes instantly without page refresh
- **Secure Document Download**: Documents are encrypted with AES-GCM; only students with the decryption key can access them
- **In-app Notifications**: Receive instant visual notifications when request status changes
- **Email Notifications**: Get notified via email when documents are ready
- **Mobile-friendly Design**: Fully responsive interface optimized for mobile devices

### For Registrars
- **Dashboard Overview**: View all student requests in a unified dashboard
- **Real-time New Request Alerts**: See new student requests instantly without refreshing
- **Status Management**: Update request status with reasons (Pending, On Process, Ready for Pick-up, Completed, Cancelled)
- **Live Status Sync**: Status changes appear instantly on student dashboards
- **Secure Document Upload**: Encrypt and upload documents directly to the system
- **Decryption Key Generation**: Generate unique decryption keys for each document
- **Student Information**: View student details associated with each request
- **Email Notifications**: Automatic email alerts sent to students on status updates

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase (PostgreSQL, Auth, Storage)
- **Authentication**: Supabase Auth with email verification
- **Database**: PostgreSQL with Row Level Security (RLS)
- **File Storage**: Supabase Storage with AES-GCM encryption
- **Notifications**: Supabase Realtime + NodeMailer
- **Real-time Updates**: Supabase Realtime subscriptions with WebSocket connections
- **UI Components**: Lucide React icons

## Security Features

- **AES-GCM Encryption**: Documents are encrypted before storage with 256-bit keys
- **PBKDF2 Key Derivation**: Secure passphrase-based key generation with 100,000 iterations
- **Role-based Access Control**: Separate access for students and registrars
- **Row Level Security**: Database-level access controls
- **Session Management**: Secure authentication with automatic session refresh

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase project (for database, auth, and storage)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd sorsu-document-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Configure your environment variables in `.env.local`:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Email Configuration (for notifications)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="SorSU Registrar <registrar@sorsu.edu.ph>"
```

5. Set up the database:
   - Run the SQL commands in `supabase-database.sql` in your Supabase project
   - This creates the necessary tables, RLS policies, and triggers
   - Run `enable-realtime.sql` to enable real-time subscriptions for live updates

6. Start the development server:
```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Schema

The system uses three main tables:

### `profiles`
Stores user information with role-based access (student/registrar).

### `requests`
Tracks document requests with status, metadata, and encryption information.

### `notifications`
Stores in-app notifications for users.

See `supabase-database.sql` for the complete schema including RLS policies.

## Real-Time Functionality

The system includes real-time updates for seamless student-registrar interactions:

### Features
- **Live Status Updates**: Students see status changes instantly without page refresh
- **Real-time New Request Alerts**: Registrars see new requests immediately
- **Visual Notifications**: In-app notifications for status changes
- **WebSocket Connections**: Efficient real-time subscriptions using Supabase Realtime

### Setup
1. Run `enable-realtime.sql` to enable real-time publications
2. Ensure Row Level Security policies are configured
3. Test using the scenarios in `REALTIME_TESTING.md`

### Technical Details
- Uses Supabase Realtime with PostgreSQL publications
- Custom React hooks for subscription management
- Role-based filtering for data privacy
- Automatic connection cleanup and error handling

## Project Structure

```
app/
├── api/                 # API routes (email sending)
├── auth/               # Authentication callbacks
├── lib/                # Shared utilities (Supabase client, AES encryption)
├── registrar/          # Registrar dashboard
├── student/            # Student pages (home, profile, notifications, requirements)
├── globals.css         # Global styles
├── layout.tsx          # Root layout
└── page.tsx            # Landing page
middleware.ts          # Route protection
```

## Usage

### For Students
1. Register for an account using your student email
2. Verify your email address
3. Log in and navigate to "My Documents"
4. Click "New Request" to submit a document request
5. Track your request status in real-time
6. Download encrypted documents when ready using the provided decryption key

### For Registrars
1. Log in with your registrar credentials
2. View pending requests in the dashboard
3. Update request status as you process documents
4. Upload encrypted documents when ready
5. Generate and share decryption keys with students
6. Mark requests as completed when documents are picked up

## Environment Variables

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

Optional (for email notifications):
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port (typically 587)
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password
- `SMTP_FROM`: From email address

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software for Sorsogon State University.

## Support

For support, please contact the SorSU Registrar's Office.
