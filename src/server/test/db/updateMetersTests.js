/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 /*
  * Initial imports.
  */
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { mocha, expect, testDB } = require('../common');
const moment = require('moment');

const Meter = require('../../models/Meter');
const Reading = require('../../models/Reading');
const updateAllMeters = require('../../services/updateMeters');
const sinon = require('sinon');

/*
 * Tests for updating meters.
 */
mocha.describe('Meter Update', () => {

	/*
	 * Recreates the database before each test.
	 */
	mocha.beforeEach(recreateDB);

	/*
	 * Tests that the updateMeters service correctly handles errors.
	 */
		// Create two meters and add them to the database
	mocha.it('can persist over a failed request', async () => {
		const conn = testDB.getConnection();
		const goodMeter = new Meter(undefined, 'GOOD', 1, true, true, Meter.type.MAMAC);
		await goodMeter.insert(conn);

		const badMeter = new Meter(undefined, 'BAD', 2, true, true, Meter.type.MAMAC);
		await badMeter.insert(conn);

		const metersToUpdate = [goodMeter, badMeter];
		
		// Create a stub to resolve a Reading for the "good" meter and reject the "bad" meter.
		const dataReader = sinon.stub();
		dataReader.withArgs(goodMeter).resolves(new Reading(
			goodMeter.id,
			0,
			moment('1970-01-01 00:00:00'),
			moment('1970-01-01 01:00:00')
		));
		dataReader.withArgs(badMeter).rejects(new Error('Bland error message'));
		dataReader.throws();

  // Update the two meters with the stub and obtain all new readings.
		await updateAllMeters(dataReader, metersToUpdate, conn);
		const goodReadings = await Reading.getAllByMeterID(goodMeter.id, conn);
		const badReadings = await Reading.getAllByMeterID(badMeter.id, conn);

		// Check that the good meter has one reading and the bad meter has none.
		expect(goodReadings.length).to.equal(1);
		expect(badReadings.length).to.equal(0);
	});
});

