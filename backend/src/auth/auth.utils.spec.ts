import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  normalizeEmail,
  assertValidPassword,
  PASSWORD_MIN_LENGTH,
  BCRYPT_MAX_BYTES,
  BCRYPT_ROUNDS,
} from './auth.utils';

describe('normalizeEmail', () => {
  it('supprime les espaces et passe en minuscules', () => {
    expect(normalizeEmail('  User@Mail.COM ')).toBe('user@mail.com');
  });

  it('renvoie une chaîne vide pour une valeur non-chaîne', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });
});

describe('assertValidPassword (politique NIST/OWASP)', () => {
  it('accepte une longue phrase de passe SANS composition (pas de maj/chiffre/symbole exigé)', () => {
    const passphrase = 'une longue phrase de passe';
    expect(assertValidPassword(passphrase)).toBe(passphrase);
    expect(assertValidPassword('unelonguephrase')).toBe('unelonguephrase');
  });

  it(`exige au moins ${PASSWORD_MIN_LENGTH} caractères`, () => {
    expect(() => assertValidPassword('Court1234')).toThrow(BadRequestException);
    expect(() =>
      assertValidPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1)),
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidPassword('a'.repeat(PASSWORD_MIN_LENGTH)),
    ).not.toThrow();
  });

  it('refuse un mot de passe dépassant la limite bcrypt (72 octets)', () => {
    expect(() => assertValidPassword('a'.repeat(BCRYPT_MAX_BYTES + 1))).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertValidPassword('a'.repeat(BCRYPT_MAX_BYTES)),
    ).not.toThrow();
  });

  it('refuse les mots de passe trop courants (liste noire SecLists chargée depuis le fichier)', () => {
    expect(() => assertValidPassword('unbelievable')).toThrow(
      BadRequestException,
    );
    expect(() => assertValidPassword('scandinavian')).toThrow(
      BadRequestException,
    );
  });

  it("refuse les mots propres à l'application (veille, veilleai, ...)", () => {
    expect(() => assertValidPassword('veillestrategique')).toThrow(
      BadRequestException,
    );
  });

  it("refuse un mot de passe contenant l'email ou le nom de l'utilisateur", () => {
    expect(() =>
      assertValidPassword('monemailsecret', { email: 'monemail@test.com' }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertValidPassword('monnomestsecret', { nom: 'MonNom' }),
    ).toThrow(BadRequestException);
  });

  it('ne transforme PAS le mot de passe (casse conservée)', () => {
    expect(assertValidPassword('FakerPassword123')).toBe('FakerPassword123');
    expect(assertValidPassword('FAKERPASSWORD123')).toBe('FAKERPASSWORD123');
    expect(assertValidPassword('fakerpassword123')).toBe('fakerpassword123');
  });
});

describe('hachage bcrypt : le mot de passe est sensible à la casse', () => {
  it('accepte la casse exacte et refuse les variantes', async () => {
    const hash = await bcrypt.hash('Faker', 10);
    expect(await bcrypt.compare('Faker', hash)).toBe(true);
    expect(await bcrypt.compare('faker', hash)).toBe(false);
    expect(await bcrypt.compare('FAKER', hash)).toBe(false);
    expect(await bcrypt.compare('Faker ', hash)).toBe(false);
  });

  it(`utilise un coût bcrypt de ${BCRYPT_ROUNDS}`, async () => {
    const hash = await bcrypt.hash('unelonguephrase', BCRYPT_ROUNDS);
    expect(hash.startsWith(`$2b$${BCRYPT_ROUNDS}$`)).toBe(true);
  });
});
