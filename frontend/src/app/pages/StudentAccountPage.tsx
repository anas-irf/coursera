import React from 'react';

import { AccountPage } from '../../features/accounts';
import { MembershipCard } from '../../features/billing';

/**
 * A student's account settings: those of every role plus the Plus membership.  The two belong to
 * different features (accounts sits below billing), so they meet here, in the app shell.
 */
export const StudentAccountPage = () => (
  <AccountPage>
    <MembershipCard />
  </AccountPage>
);

export default StudentAccountPage;
