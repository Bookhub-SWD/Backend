# BookHub – Multi-School Library Social SaaS

## 1. System Overview
BookHub is a SaaS platform designed for multiple schools to share a unified library management and social platform. It enables online book borrowing, library inventory management, and community building for book enthusiasts.

---

## 2. Actors
| Actor | Description |
| :--- | :--- |
| **Student** | Borrows books, reads, reviews, and participates in or hosts events. |
| **Librarian** | Manages book inventory, processes borrowing/returns, and manages events. |
| **Teacher / Staff** | Participates in borrowing, reading, and reviewing. |
| **System Admin** | Manages permissions, school-level settings, and system-wide configurations. |
| **System (Automated)** | Sends notifications, checks for overdue books, and manages queues. |

---

## 3. Functional Blocks
The system is divided into 6 independent business modules:

1. **Library Inventory**: Manage books and physical copies with statuses: `available`, `reserved`, `borrowed`.
2. **Borrowing & Reservation**: Online reservation, physical pickup, returns, and overdue fine calculation.
3. **Social & Discovery**: Reviews, ratings, borrow counts, and trending books.
4. **Events & Notifications**: Book launches, reading sessions, reminders, and push notifications.
5. **Multi-school SaaS**: Multi-tenant architecture where each school has its own private library and data silo.
6. **Book Social**: Community sharing, posts about books, comments, and interactions.

---

## 4. Data Concepts (ERD Foundation)

### School & User
- **School**: Tenant information.
- **User**: Name, email, school association.
- **Role**: Admin, Librarian, Student, Teacher.

### Library
- **Library**: Belonging to a specific school.
- **Book**: Metadata (Title, Author, ISBN).
- **BookCopy**: Individual physical item tracked by Unique ID.

### Transaction
- **Borrowing**: Header information for borrowing sessions.
- **Reservation**: Queue or waiting for pickup state.
- **BorrowTransaction**: Active borrowing record.
- **ReturnRecord**: History of returned books.
- **Fine**: Overdue penalty records.

### Social & Events
- **Review / Rating**: User feedback on books.
- **BookTrend**: Analytical data (views, borrow counts).
- **Event / EventParticipant**: Management of library events.
- **Notification**: User-specific alerts.

---

## 5. Key Business Flows

### Flow 1: Online Borrowing
1. **Search**: Student finds a book.
2. **Availability**: System checks `BookCopy` count.
3. **Reserve**: Student clicks "Reserve".
4. **Status**: Creates Reservation as "Waiting for pickup".
5. **Confirmation**: Librarian confirms pickup.
6. **Pickup**: Student scans QR code; Reservation → BorrowTransaction; BookCopy → Borrowed.

### Flow 2: Queue Management (Waitlist)
1. **Full**: All copies are borrowed.
2. **Reserve**: Student clicks "Reserve" → Reservation becomes "In Queue".
3. **Return**: Another user returns a book.
4. **Notification**: System selects the first in queue and notifies them.

### Flow 3: Return & Fines
1. **Return**: Librarian receives the book.
2. **Overdue Check**: System checks return date vs due date.
3. **Fine**: If late, a `Fine` record is created.
4. **Payment**: Student pays through gateway.
5. **Available**: BookCopy status reset to `Available`.

---

## 6. System Boundaries
BookHub interacts with:
- **Student App**: Mobile interface for users.
- **Librarian/Admin Portal**: Web interface for management.
- **Payment Gateway**: For processing fine payments.
- **Notification Service**: Email/Push for reminders and alerts.

---

## 7. Service Architecture (Logical Services)
- **User Service**: Identity and Tenant management.
- **Library Service**: Catalog and Inventory.
- **Borrowing Service**: Core logic for reservations and transactions.
- **Social Service**: Reviews, feeds, and trending logic.
- **Event & Notification Service**: Scheduling and alerting.
- **Payment Service**: Integration with financial providers.
