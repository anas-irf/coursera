import React from 'react';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import http from '../../shared/api/client';
import { createQueryClient } from '../../shared/query/client';
import { QueryProvider } from '../../shared/query/QueryProvider';
import { ToastProvider } from '../../shared/ui/Toast';
import CertificatesPage from './pages/CertificatesPage';
import VerifyCertificatePage from './pages/VerifyCertificatePage';
import type { Certificate, CertificateVerification } from './types';

// the pages are exercised through their hooks and api module: only the HTTP client is replaced
jest.mock('../../shared/api/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockedGet = jest.mocked(http.get);

const serverError = Object.assign(new Error('Request failed with status code 500'), {
  response: { status: 500, data: { error: 'The server had a problem.' } },
});

const certificate: Certificate = {
  id: 'cert-1',
  course_title: 'Introduction to Python',
  instructor: 'Demo Instructor',
  issue_date: '2026-09-20T10:00:00Z',
  certificate_id: 'CERT-1A2B3C4D-0011223344',
  verification_url: 'http://localhost:3000/verify/abc123',
  grade: 88,
  thumbnail: null,
};

const verification: CertificateVerification = {
  certificate_number: 'CERT-1A2B3C4D-0011223344',
  verification_code: 'abc123',
  student_name: 'Demo Student',
  course_title: 'Introduction to Python',
  instructor: 'Demo Instructor',
  issue_date: '2026-09-20T10:00:00Z',
  grade: 88,
  course_hours: 6,
};

const renderWith = (page: ReactElement, path = '/') =>
  render(
    <QueryProvider client={createQueryClient({ retryDelay: 1 })}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/student/certificates" element={page} />
            <Route path="/verify/:code" element={page} />
            <Route path="/" element={<p>home page</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryProvider>
  );

beforeEach(() => jest.clearAllMocks());

describe('my certificates', () => {
  const open = () => renderWith(<CertificatesPage />, '/student/certificates');

  test('each certificate shows the course, the grade, the credential and its public link', async () => {
    mockedGet.mockResolvedValue({ data: [certificate] });
    open();

    const card = await screen.findByRole('article', { name: 'Introduction to Python' });
    expect(mockedGet).toHaveBeenCalledWith('/certificates/');
    expect(card).toHaveTextContent('by Demo Instructor');
    expect(card).toHaveTextContent('88%');
    expect(within(card).getByText('Credential ID')).toBeInTheDocument();
    expect(within(card).getByText('CERT-1A2B3C4D-0011223344')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Verify Certificate' })).toHaveAttribute(
      'href',
      'http://localhost:3000/verify/abc123'
    );
  });

  test('the verification link can be copied', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mockedGet.mockResolvedValue({ data: [certificate] });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Copy link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('http://localhost:3000/verify/abc123'));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  test('a learner without certificates is told how to earn one', async () => {
    mockedGet.mockResolvedValue({ data: [] });
    open();

    expect(await screen.findByText('No certificates yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My Learning' })).toHaveAttribute('href', '/student/my-learning');
  });

  test('a list that could not be loaded is an error with a retry, not "No certificates yet"', async () => {
    mockedGet.mockRejectedValueOnce(serverError).mockRejectedValueOnce(serverError);
    mockedGet.mockResolvedValue({ data: [certificate] });
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('The server had a problem.');
    expect(screen.queryByText('No certificates yet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('article', { name: 'Introduction to Python' })).toBeInTheDocument();
  });
});

describe('the public verification page', () => {
  const open = (code = 'abc123') => renderWith(<VerifyCertificatePage />, `/verify/${code}`);

  test('shows who earned which certificate, and that it is verified', async () => {
    mockedGet.mockResolvedValue({ data: verification });
    open();

    expect(await screen.findByRole('heading', { name: 'Demo Student' })).toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledWith('/certificates/verify/abc123/');
    expect(screen.getByRole('heading', { name: 'Introduction to Python' })).toBeInTheDocument();
    expect(screen.getByText('Verified certificate')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Final grade: 88%')).toBeInTheDocument();
    expect(screen.getByText(/taught by Demo Instructor · about 6 hours of study/)).toBeInTheDocument();
    expect(screen.getByText('CERT-1A2B3C4D-0011223344')).toBeInTheDocument();
    expect(document.title).toBe('Demo Student: Introduction to Python | Coursera Clone');
  });

  test('the certificate can be printed or saved as a PDF', async () => {
    const print = jest.spyOn(window, 'print').mockImplementation(() => {});
    mockedGet.mockResolvedValue({ data: verification });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Print or save as PDF' }));

    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  test('the code is put into the address as data', async () => {
    mockedGet.mockResolvedValue({ data: verification });
    open('a b');

    await screen.findByRole('heading', { name: 'Demo Student' });
    expect(mockedGet).toHaveBeenCalledWith('/certificates/verify/a%20b/');
  });

  test('an unknown code says so, without a retry', async () => {
    mockedGet.mockRejectedValue({ response: { status: 404, data: { error: 'No certificate has this verification code.' } } });
    open('nope');

    expect(await screen.findByRole('heading', { name: 'No certificate has this code' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(mockedGet).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('link', { name: 'Go to the home page' }));
    expect(await screen.findByText('home page')).toBeInTheDocument();
  });

  test('a server that cannot be reached is an error with a retry', async () => {
    mockedGet.mockRejectedValueOnce(serverError).mockRejectedValueOnce(serverError);
    mockedGet.mockResolvedValue({ data: verification });
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('The certificate could not be checked');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Demo Student' })).toBeInTheDocument();
  });
});
