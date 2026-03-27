const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendWelcomeEmail, sendOTPEmail } = require('../utils/email');
const { auth } = require('../middleware/auth');

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role)
      return res.status(400).json({ message: 'All fields are required' });
    if (!['admin', 'staff'].includes(role))
      return res.status(400).json({ message: 'Role must be admin or staff' });
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(400).json({ message: 'Username or email already exists' });

    const user = new User({ username, email, password, role });
    await user.save();

    // Send welcome email (non-blocking — don't fail registration if email fails)
    sendWelcomeEmail(email, username, role).catch(err =>
      console.error('Welcome email failed:', err.message)
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password are required' });
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    await AuditLog.create({
      action: 'USER_LOGIN',
      performedBy: user._id,
      details: { username: user.username, role: user.role }
    });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

// Search admin by username (for staff)
router.get('/search-admin', auth, async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Username query required' });
    const admin = await User.findOne({ username, role: 'admin' }).select('-password');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Change password (authenticated)
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'Current and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch)
      return res.status(400).json({ message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    await AuditLog.create({
      action: 'PASSWORD_CHANGED',
      performedBy: user._id,
      details: { username: user.username }
    });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Step 1: Forgot password — send OTP to email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Always respond generically to prevent email enumeration
    if (!user)
      return res.json({ message: 'If that email is registered, an OTP has been sent.' });

    // Delete any existing tokens for this user
    await PasswordResetToken.deleteMany({ user: user._id });

    const otp = generateOTP();
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await PasswordResetToken.create({
      user: user._id,
      token: sessionToken,
      otp,
      expiresAt
    });

    // Send OTP email
    await sendOTPEmail(user.email, user.username, otp);

    await AuditLog.create({
      action: 'PASSWORD_RESET_REQUESTED',
      performedBy: user._id,
      details: { email: user.email }
    });

    // Return session token to frontend (used when submitting OTP + new password)
    res.json({
      message: 'OTP sent to your email. Valid for 15 minutes.',
      sessionToken
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Check GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env' });
  }
});

// Step 2: Verify OTP + set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { sessionToken, otp, newPassword } = req.body;
    if (!sessionToken || !otp || !newPassword)
      return res.status(400).json({ message: 'Session token, OTP and new password are required' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const resetToken = await PasswordResetToken.findOne({
      token: sessionToken,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetToken)
      return res.status(400).json({ message: 'Session expired. Please request a new OTP.' });

    if (resetToken.otp !== otp.trim())
      return res.status(400).json({ message: 'Invalid OTP. Please check your email and try again.' });

    const user = await User.findById(resetToken.user);
    if (!user)
      return res.status(400).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save();

    resetToken.used = true;
    await resetToken.save();

    await AuditLog.create({
      action: 'PASSWORD_RESET_COMPLETED',
      performedBy: user._id,
      details: { username: user.username }
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
