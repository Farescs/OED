/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const database = require('./database');
const Meter = require('./Meter');

const getDB = database.getDB;
const sqlFile = database.sqlFile;

class Group {

	/**
	 * @param id should be undefined when creating a new group
	 * @param name group's name
	 */
	constructor(id, name) {
		this.id = id;
		this.name = name;
	}

	/**
	 * Returns a promise to create all the groups tables.
	 * @returns {Promise.<>}
	 */
	static createTables() {
		return getDB().none(sqlFile('group/create_groups_tables.sql'));
	}

	/**
	 * Returns a promise to insert this group into the db
	 * @param conn a function returning the connection to be used, defaults to the default database connection.
	 * @return {Promise.<void>}
	 */
	async insert(conn = getDB) {
		const group = this;
		if (group.id !== undefined) {
			throw new Error('Attempt to insert a group that already has an ID');
		}
		const resp = await conn().one(sqlFile('group/insert_new_group.sql'), group);
		// resp = { id: 42 }, hence this line
		this.id = resp.id;
	}

	/**
	 * Creates a new group based on the data in a row
	 * @param row the row from which a group is to be created
	 * @returns {Group}
	 */
	static mapRow(row) {
		return new Group(row.id, row.name);
	}

	/**
	 * Returns a promise to retrieve the meter with the given name.
	 * @param name the groups name
	 * @param conn a function returning the connection to be used, defaults to the default database connection.
	 * @returns {Promise.<Group>}
	 */
	static async getByName(name, conn = getDB) {
		const row = await conn().one(sqlFile('group/get_group_by_name.sql'), { name: name });
		return Group.mapRow(row);
	}

	/**
	 * Returns a promise to retrieve the group with the given id.
	 * @param id the id of the group
	 * @param conn function returning the connection to be used, defaults to the default database connection.
	 * @returns {Promise.<*>}
	 */
	static async getByID(id, conn = getDB) {
		const row = await conn().one(sqlFile('group/get_group_by_id.sql'), { id: id });
		return Group.mapRow(row);
	}

	/**
	 * returns a promise to retrieve all groups in the database
	 * @param conn function returning the connection to be used, defaults to the default database connection.
	 * @returns {Promise.<void>}
	 */
	static async getAll(conn = getDB) {
		const rows = await conn().any(sqlFile('group/get_all_groups.sql'));
		return rows.map(Group.mapRow);
	}

	/**
	 * Returns a promise to retrieve the IDs of all meters that are immediate children of the group with the given id.
	 * @param id The id of the group whose meters you are desirous of seeing.
	 * @param conn function returning the connection to be used, defaults to the default database connection.
	 * @returns {Promise.<*>}
	 */
	static async getImmediateMetersByGroupID(id, conn = getDB) {
		const rows = await conn().any(sqlFile('group/get_immediate_meters_by_group_id.sql'), { id: id });
		return rows.map(row => row.meter_id);
	}

	/**
	 * Returns a promise to retrieve the IDs of all the child groups of the group whose id is given.
	 * @param id the id of the group whose children are to be retrieved
	 * @param conn function returning the connection to be used, defaults to the default database connection.
	 * @returns {Promise.<*>}
	 */
	static async getImmediateGroupsByGroupID(id, conn = getDB) {
		const rows = await conn().any(sqlFile('group/get_immediate_groups_by_group_id.sql'), { id: id });
		return rows.map(row => row.child_id);
	}

	/**
	 * Returns a promise to associate this group with a child group
	 * @param childID ID of the meter to be the child
	 * @param conn function returning the connection to be used, defaults to the default database connection.
	 * @return {Promise.<void>}
	 */
	async adoptGroup(childID, conn = getDB) {
		// Confirm that such a group exists
		const child = await Group.getByID(childID, conn);
		await conn().none(sqlFile('group/associate_child_group_with_parent_group.sql'), { parent_id: this.id, child_id: child.id });
	}

	/**
	 * Returns a promise to make the meter with the given ID an immediate child of this group.
	 * @param childID
	 * @param conn
	 * @return {Promise.<void>}
	 */
	async adoptMeter(childID, conn = getDB) {
		const meter = await Meter.getByID(childID, conn);
		await conn().none(sqlFile('group/associate_child_meter_with_parent_group.sql'), { group_id: this.id, meter_id: meter.id });
	}

	/**
	 *  Returns a promise to retrieve all the IDs of the deep child groups of the group with the given ID.
	 * @param id
	 * @param conn
	 * @return {Promise.<void>}
	 */
	static async getDeepGroupsByGroupID(id, conn = getDB) {
		const rows = await conn().any(sqlFile('group/get_deep_groups_by_group_id.sql'), { id });
		return rows.map(row => row.child_id);
	}

	/**
	 * Returns a promise to retrieve all the IDs of deep child meters of the group with the given ID.
	 * @param id
	 * @param conn
	 * @return {Promise.<void>}
	 */
	static async getDeepMetersByGroupID(id, conn = getDB) {
		const rows = await conn().any(sqlFile('group/get_deep_meters_by_group_id.sql'), { id });
		return rows.map(row => row.meter_id);
	}

	/**
	 * Change the name of this group
	 * @param newName New name for the group
	 * @param conn function returning the connection to be used, defaults to the default database connection.
	 * @return {Promise.<void>}
	 */
	async rename(newName, conn = getDB) {
		await conn().none(sqlFile('group/rename_group.sql'), { new_name: newName, id: this.id });
	}

	/**
	 * Returns a promise to remove the group with childID from the children of this group.
	 * @param childID The child group to be disowned
	 * @param conn the connection to be used.
	 * @return {Promise.<void>}
	 */
	async disownGroup(childID, conn = getDB) {
		await conn().none(sqlFile('group/disown_child_group.sql'), { parent_id: this.id, child_id: childID });
	}

	/**
	 * Returns a promise to remove the group with childID from the children of this group.
	 * @param childID The child group to be disowned
	 * @param conn the connection to be used.
	 * @return {Promise.<void>}
	 */
	async disownMeter(meterID, conn = getDB) {
		await conn().none(sqlFile('group/disown_child_meter.sql'), { parent_id: this.id, meter_id: meterID });
	}

	/**
	 * Returns a promise to retrieve an array of the group IDs of the parent groups of this group
	 * @param conn The connection to be used. Defaults to the default database connection.
	 * @return {Promise<IArrayExt<any>>}
	 */
	async getParents(conn = getDB) {
		const rows = await conn().any(sqlFile('group/get_parents_by_group_id.sql'), { child_id: this.id });
		return rows.map(row => row.parent_id);
	}

	/**
	 * Returns a promise to delete a group and purge all trace of it form the memories of its parents and children
	 * @param groupID The ID of the group to be deleted
	 * @param conn The connection to be used. Defaults to (*GASP!*) the default database connection
	 * @return {Promise.<void>}
	 */
	static async delete(groupID, conn = getDB) {
		await conn().none(sqlFile('group/delete_group.sql'), { id: groupID });
	}
}
module.exports = Group;
