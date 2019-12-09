import 'jasmine';
import mock from 'xhr-mock';
import { Loupe } from '../src/loupe.agent';

describe('wibble', () => {

    beforeEach(() => mock.setup());

    afterEach(() => mock.teardown());
    

    it('should wobble', done => {
        jasmine.clock().install();
        mock.post('http://localhost:3500/', {});
        spyOn(mock, "post");

        // jasmine.createSpy()

        const loupe = new Loupe();
        loupe.setCORSOrigin('http://localhost:3500/');
        loupe.information('test', 'test', 'test description');
        
        // waits(500);

        // setTimeout(() => {
        //     expect(mock.post).toHaveBeenCalledWith('http://localhost:3500/Loupe/log', {});
        //     done();
        // }, 1000);

        jasmine.clock().tick(1000);

        expect(mock.post).toHaveBeenCalledWith('http://localhost:3500/Loupe/log', {});
    });
});
