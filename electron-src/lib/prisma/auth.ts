import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: string;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT token
export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return null;
  }
}

// Login user
export async function loginUser(username: string, password: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    if (!user.passwordHash) {
      throw new Error('パスワードが設定されていません');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('パスワードが正しくありません');
    }

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      token,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '認証に失敗しました',
    };
  }
}

// Create new user
export async function createUser(userData: {
  username: string;
  password: string;
  name: string;
  role?: string;
}) {
  try {
    // Check if username already exists
    const existing = await prisma.user.findUnique({
      where: { username: userData.username },
    });

    if (existing) {
      throw new Error('このユーザー名は既に使用されています');
    }

    // Hash password
    const passwordHash = await hashPassword(userData.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: userData.username,
        passwordHash,
        name: userData.name,
        role: userData.role || 'teacher',
      },
    });

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
      token,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ユーザーの作成に失敗しました',
    };
  }
}

// Get user by token
export async function getUserByToken(token: string) {
  try {
    const payload = verifyToken(token);
    if (!payload) {
      throw new Error('無効なトークンです');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new Error('ユーザーが見つかりません');
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '認証に失敗しました',
    };
  }
}

// Update user password
export async function updateUserPassword(userId: string, newPassword: string) {
  try {
    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'パスワードの更新に失敗しました',
    };
  }
}